#!/usr/bin/env bash
# Run this worktree's Metro on its own port and point this worktree's own Android emulator at it.
# A debug APK loads from the dev-server port baked in at build time (emulator:
# 10.0.2.2:<port>), so whichever worktree's Metro holds that port wins.
# expo-wt gives each worktree a stable port (hashed from its path, 8082–8099)
# and sets the app's debug_http_host pref (dev menu "Change bundle location").
# Each worktree owns one emulator, the AVD <repo>_wt_<worktree> (e.g. recur_wt_auk, shown in its window title).
# The first run clones it from $AVD, app and data included; later runs boot it or reuse it. Other emulators
# are never touched, so several worktrees run side by side.
# Usage (from anywhere inside an Expo worktree):
#   expo-wt                  # start Metro on this worktree's port, wire + restart the app on its emulator
#   expo-wt -c               # extra args go to `expo start` (-c = clear cache)
#   expo-wt -s R5CT30ABCDE   # use another device instead (a phone, or any emulator serial)
#   expo-wt --attach         # Metro already running here: only re-wire + restart
#   expo-wt --port           # print this worktree's port and exit
#   expo-wt --print-serial   # print this worktree's emulator serial (for adb -s) and exit
#   expo-wt --prune          # delete the emulators of worktrees that no longer exist
#   AVD=Pixel_6 expo-wt      # AVD a new worktree emulator is cloned from (default: first non-worktree AVD)
#   expo-wt --ios            # same, for the iOS Simulator (booted one, else the first iPhone)
#   SIM="iPhone 17 Pro" expo-wt --ios  # pick the simulator by name or UDID
# Needs a debuggable (debug) build: the pref is written with `run-as`.
# iOS needs the debug app installed once: `npx expo run:ios -d "<simulator>"`. Its prebuilt React Native
# ignores the build-time port, so expo-wt sets the "Configure Bundler" location (RCT_jsLocation) instead.
set -euo pipefail

SERIAL="${ANDROID_SERIAL:-}"
IOS=false
ATTACH=false
PRINT_PORT=false
PRINT_SERIAL=false
PRUNE=false
EXPO_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -s|--serial)    SERIAL="$2"; shift ;;
    --ios)          IOS=true ;;
    --attach)       ATTACH=true ;;
    --port)         PRINT_PORT=true ;;
    --print-serial) PRINT_SERIAL=true ;;
    --prune)        PRUNE=true ;;
    -h|--help)      grep '^#' "$0" | sed -n '2,23p' | cut -c3-; exit 0 ;;
    *)              EXPO_ARGS+=("$1") ;;
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

EMULATOR=$(command -v emulator || echo /opt/homebrew/share/android-commandlinetools/emulator/emulator)
AVD_HOME="${ANDROID_AVD_HOME:-${ANDROID_USER_HOME:-$HOME/.android}/avd}"
REPO=$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")
AVD_PREFIX="${REPO//[^A-Za-z0-9._-]/_}_wt_"

avd_name() {
  local base
  base=$(basename "$1")
  echo "$AVD_PREFIX${base//[^A-Za-z0-9._-]/_}"
}

OWN_AVD=$(avd_name "$ROOT")

# adb misses emulators on ports above 5585 once its server restarts, so find them by process.
avd_pids() {
  local pid
  for pid in $(pgrep -u "$(id -u)" qemu-system || true); do
    if [[ " $(ps -o command= -p "$pid") " == *" -avd $1 "* ]]; then
      echo "$pid"
    fi
  done
}

own_pid() {
  local pids
  pids=$(avd_pids "$OWN_AVD")
  echo "${pids%%$'\n'*}"
}

clone_avd() {
  local base pid tmp="$AVD_HOME/.$OWN_AVD.avd.tmp"
  base="${AVD:-$("$EMULATOR" -list-avds | awk -v p="$AVD_PREFIX" 'index($0, p) != 1 && !found { print; found = 1 }')}"
  if [ -z "$base" ] || [ ! -d "$AVD_HOME/$base.avd" ]; then
    echo "expo-wt: no AVD to clone $OWN_AVD from, create one in Android Studio or set AVD=<name>" >&2
    exit 1
  fi
  # A running base is still writing its disk: flush it so the copy boots like after a clean power cut.
  for pid in $(avd_pids "$base"); do
    "$ADB" -s "$(emulator_serial "$pid")" shell sync >/dev/null 2>&1 || true
  done
  echo "expo-wt: creating $OWN_AVD from $base (app and data included)…"
  rm -rf "$tmp"
  # -c clones on APFS: instant, and disk is only used as the two emulators drift apart.
  cp -cR "$AVD_HOME/$base.avd" "$tmp"
  rm -rf "$tmp/snapshots" "$tmp/tmpAdbCmds" "$tmp"/*.lock "$tmp/hardware-qemu.ini" "$tmp/emu-launch-params.txt" \
    "$tmp/bootcompleted.ini" "$tmp/read-snapshot.txt"
  {
    grep -v -e '^path=' -e '^path.rel=' "$AVD_HOME/$base.ini"
    echo "path=$AVD_HOME/$OWN_AVD.avd"
    echo "path.rel=avd/$OWN_AVD.avd"
  } >"$tmp.ini"
  rm -rf "${AVD_HOME:?}/$OWN_AVD.avd"
  mv "$tmp" "$AVD_HOME/$OWN_AVD.avd"
  mv "$tmp.ini" "$AVD_HOME/$OWN_AVD.ini"
}

start_own_emulator() {
  local pid launcher log="${TMPDIR:-/tmp}/expo-wt-$OWN_AVD.log"
  pid=$(own_pid)
  if [ -z "$pid" ]; then
    if [ ! -f "$AVD_HOME/$OWN_AVD.ini" ]; then
      clone_avd
    fi
    echo "expo-wt: booting ${OWN_AVD}…"
    # Own process group, so stopping Metro with Ctrl-C leaves the emulator running.
    set -m
    nohup "$EMULATOR" -avd "$OWN_AVD" </dev/null >"$log" 2>&1 &
    launcher=$!
    set +m
    until pid=$(own_pid); [ -n "$pid" ] && [ -n "$(emulator_serial "$pid")" ]; do
      if [ -z "$pid" ] && ! kill -0 "$launcher" 2>/dev/null; then
        echo "expo-wt: $OWN_AVD quit while starting, see $log" >&2
        exit 1
      fi
      sleep 1
    done
  fi
  SERIAL=$(emulator_serial "$pid")
  DEVICE_NAME=$OWN_AVD
  echo "expo-wt: $OWN_AVD is $SERIAL"
}

if $PRINT_SERIAL; then
  pid=$(own_pid)
  if [ -z "$pid" ]; then
    echo "expo-wt: $OWN_AVD isn't running" >&2
    exit 1
  fi
  emulator_serial "$pid"
  exit 0
fi

if $PRUNE; then
  live=$(git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
    if [ -d "$wt" ]; then
      avd_name "$wt"
    fi
  done)
  for name in $("$EMULATOR" -list-avds); do
    if [[ "$name" != "$AVD_PREFIX"* ]] || grep -qxF "$name" <<<"$live"; then
      continue
    fi
    if [ -n "$(avd_pids "$name")" ]; then
      echo "expo-wt: keeping $name, it's running"
      continue
    fi
    rm -rf "${AVD_HOME:?}/$name.avd" "${AVD_HOME:?}/$name.ini"
    echo "expo-wt: deleted $name"
  done
  exit 0
fi

if ! $IOS && [ -z "$SERIAL" ]; then
  start_own_emulator
fi

wire_android() {
  "$ADB" -s "$SERIAL" wait-for-device
  until [ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 1
  done
  if [ -z "$("$ADB" -s "$SERIAL" shell pm path "$PKG" 2>/dev/null)" ]; then
    echo "expo-wt: $PKG isn't installed on $SERIAL. Build it once: npx expo run:android -d${DEVICE_NAME:+ $DEVICE_NAME}" >&2
    return 1
  fi
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
