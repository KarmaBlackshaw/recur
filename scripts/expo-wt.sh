#!/usr/bin/env bash
# Run this worktree's Metro on its own port and point an Android device at it.
# A debug APK loads from the dev-server port baked in at build time (emulator:
# 10.0.2.2:<port>), so whichever worktree's Metro holds that port wins.
# expo-wt gives each worktree a stable port (hashed from its path, 8082–8099)
# and sets the app's debug_http_host pref (dev menu "Change bundle location").
# Usage (from anywhere inside an Expo worktree):
#   expo-wt                  # start Metro on this worktree's port, wire + restart the app
#   expo-wt -c               # extra args go to `expo start` (-c = clear cache)
#   expo-wt -s emulator-5556 # pick the device when several are attached
#   expo-wt --attach         # Metro already running here: only re-wire + restart
#   expo-wt --port           # print this worktree's port and exit
#   AVD=Pixel_6 expo-wt      # AVD to boot when no device is attached (default: first AVD)
# One emulator: the last worktree you run is the one you see.
# One emulator per worktree: `emulator -avd <avd> -read-only &`, then `-s <serial>`.
# Needs a debuggable (debug) build: the pref is written with `run-as`.
set -euo pipefail

SERIAL="${ANDROID_SERIAL:-}"
ATTACH=false
PRINT_PORT=false
EXPO_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -s|--serial) SERIAL="$2"; shift ;;
    --attach)    ATTACH=true ;;
    --port)      PRINT_PORT=true ;;
    -h|--help)   grep '^#' "$0" | sed -n '2,16p' | cut -c3-; exit 0 ;;
    *)           EXPO_ARGS+=("$1") ;;
  esac
  shift
done

ROOT=$(git rev-parse --show-toplevel)
PORT=$(( 8082 + $(printf '%s' "$ROOT" | cksum | cut -d' ' -f1) % 18 ))

holder_cwd() {
  local pid
  pid=$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$pid" ] && lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
  return 0
}

while true; do
  owner=$(holder_cwd "$PORT")
  if [ -z "$owner" ] || [ "$owner" = "$ROOT" ]; then
    break
  fi
  # ponytail: linear probe on collision, ports stay stable unless two hashes clash
  PORT=$(( PORT + 1 ))
done

if $PRINT_PORT; then
  echo "$PORT"
  exit 0
fi

ADB=$(command -v adb || echo /opt/homebrew/share/android-commandlinetools/platform-tools/adb)
PKG=$(node -p "require('$ROOT/app.json').expo.android.package")

if [ -z "$SERIAL" ]; then
  DEVICES=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')
  COUNT=$(printf '%s' "$DEVICES" | grep -c . || true)
  if [ "$COUNT" -eq 0 ]; then
    EMULATOR=$(command -v emulator || echo /opt/homebrew/share/android-commandlinetools/emulator/emulator)
    AVD="${AVD:-$("$EMULATOR" -list-avds | head -1)}"
    if [ -z "$AVD" ]; then
      echo "expo-wt: no device attached and no AVD found" >&2
      exit 1
    fi
    echo "expo-wt: no device attached, booting ${AVD}…"
    nohup "$EMULATOR" -avd "$AVD" >/dev/null 2>&1 &
    "$ADB" wait-for-device
    until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      sleep 1
    done
    DEVICES=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')
    COUNT=1
  fi
  if [ "$COUNT" -gt 1 ]; then
    echo "expo-wt: several devices, pick one with -s:" >&2
    echo "$DEVICES" >&2
    exit 1
  fi
  SERIAL="$DEVICES"
fi

wire() {
  until curl -s "localhost:$PORT/status" | grep -q running; do
    sleep 1
  done
  local host="localhost:$PORT"
  if [[ "$SERIAL" == emulator-* ]]; then
    host="10.0.2.2:$PORT"
  else
    "$ADB" -s "$SERIAL" reverse tcp:"$PORT" tcp:"$PORT" >/dev/null
  fi
  "$ADB" -s "$SERIAL" shell am force-stop "$PKG"
  # The dev-menu "Change bundle location" pref; overrides the port baked into the APK.
  "$ADB" -s "$SERIAL" shell "run-as $PKG sh -c 'mkdir -p shared_prefs && echo \"<?xml version=\\\"1.0\\\" encoding=\\\"utf-8\\\" standalone=\\\"yes\\\" ?><map><string name=\\\"debug_http_host\\\">$host</string></map>\" > shared_prefs/${PKG}_preferences.xml'"
  "$ADB" -s "$SERIAL" shell am start -n "$PKG/.MainActivity" >/dev/null
  echo "expo-wt: $SERIAL → $(basename "$ROOT") Metro :$PORT, $PKG restarted"
}

if [ "$(holder_cwd "$PORT")" = "$ROOT" ]; then
  echo "expo-wt: Metro already running for $(basename "$ROOT") on :$PORT (pid $(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -1)), re-pointing only${EXPO_ARGS[*]+ — ignored: ${EXPO_ARGS[*]}}"
  wire
  exit 0
fi
if $ATTACH; then
  echo "expo-wt: no Metro running for $(basename "$ROOT") on :$PORT" >&2
  exit 1
fi

cd "$ROOT"
wire &
exec npx expo start --port "$PORT" ${EXPO_ARGS[@]+"${EXPO_ARGS[@]}"}
