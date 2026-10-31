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
#   expo-wt --ios            # same, for the iOS Simulator (booted one, else the first iPhone)
#   SIM="iPhone 17 Pro" expo-wt --ios  # pick the simulator by name or UDID
# One emulator: expo-wt quits every other one, headless (-no-window) ones included, and keeps the first
# with a window (or the one named with -s). The last worktree you run is the one you see.
# Needs a debuggable (debug) build: the pref is written with `run-as`.
# iOS needs the debug app installed once: `npx expo run:ios -d "<simulator>"`. Its prebuilt React Native
# ignores the build-time port, so expo-wt sets the "Configure Bundler" location (RCT_jsLocation) instead.
set -euo pipefail

SERIAL="${ANDROID_SERIAL:-}"
IOS=false
ATTACH=false
PRINT_PORT=false
EXPO_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -s|--serial) SERIAL="$2"; shift ;;
    --ios)       IOS=true ;;
    --attach)    ATTACH=true ;;
    --port)      PRINT_PORT=true ;;
    -h|--help)   grep '^#' "$0" | sed -n '2,20p' | cut -c3-; exit 0 ;;
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

wire_ios() {
  until curl -s "localhost:$PORT/status" | grep -q running; do
    sleep 1
  done
  xcrun simctl spawn "$SIM" defaults write "$BUNDLE_ID" RCT_jsLocation -string "localhost:$PORT"
  xcrun simctl terminate "$SIM" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl launch "$SIM" "$BUNDLE_ID" >/dev/null
  echo "expo-wt: iOS simulator $SIM → $(basename "$ROOT") Metro :$PORT, $BUNDLE_ID relaunched"
}

if $IOS; then
  BUNDLE_ID=$(node -p "require('$ROOT/app.json').expo.ios.bundleIdentifier")
  udid_of() {
    xcrun simctl list devices "$@" | grep -o -E '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1
  }
  if [ -n "${SIM:-}" ] && ! [[ "$SIM" =~ ^[0-9A-F-]{36}$ ]]; then
    SIM=$(xcrun simctl list devices available | grep -F "$SIM (" | grep -o -E '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)
  fi
  SIM="${SIM:-$(udid_of booted)}"
  if [ -z "$SIM" ]; then
    SIM=$(xcrun simctl list devices available | grep "iPhone" | grep -o -E '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)
    [ -z "$SIM" ] && { echo "expo-wt: no iOS simulator found" >&2; exit 1; }
    echo "expo-wt: no simulator booted, booting $SIM…"
  fi
  xcrun simctl boot "$SIM" 2>/dev/null || true
  open -a Simulator
  if ! xcrun simctl get_app_container "$SIM" "$BUNDLE_ID" >/dev/null 2>&1; then
    echo "expo-wt: $BUNDLE_ID isn't installed on $SIM. Build it once: npx expo run:ios -d $SIM" >&2
    exit 1
  fi
fi

ADB=$(command -v adb || echo /opt/homebrew/share/android-commandlinetools/platform-tools/adb)
PKG=$(node -p "require('$ROOT/app.json').expo.android.package")

emulator_serial() {
  lsof -nP -a -p "$1" -iTCP -sTCP:LISTEN -Fn 2>/dev/null | sed -nE 's/^n.*:(5[5-6][0-9]{2})$/\1/p' | sort -n | head -1 | sed 's/^/emulator-/'
}

is_headless() {
  ps -o command= -p "$1" | grep -q -- ' -no-window'
}

if ! $IOS && [[ -z "$SERIAL" || "$SERIAL" == emulator-* ]]; then
  KEEP=""
  QUIT=""
  # adb misses emulators on ports above 5585 once its server restarts, so list the processes instead.
  for pid in $(pgrep -u "$(id -u)" qemu-system || true); do
    if [ -z "$KEEP" ] && ! is_headless "$pid" && [[ -z "$SERIAL" || "$(emulator_serial "$pid")" == "$SERIAL" ]]; then
      KEEP=$pid
    else
      QUIT="$QUIT $pid"
    fi
  done
  if [ -n "$SERIAL" ] && [ -z "$KEEP" ]; then
    echo "expo-wt: $SERIAL isn't a running emulator with a window" >&2
    exit 1
  fi
  for pid in $QUIT; do
    echo "expo-wt: quitting emulator $(emulator_serial "$pid")"
    kill "$pid"
  done
  for pid in $QUIT; do
    while kill -0 "$pid" 2>/dev/null; do
      sleep 1
    done
  done
fi

if ! $IOS && [ -z "$SERIAL" ]; then
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

wire_android() {
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

wire() {
  if $IOS; then
    wire_ios
  else
    wire_android
  fi
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
