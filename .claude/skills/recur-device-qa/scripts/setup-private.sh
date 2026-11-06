#!/usr/bin/env bash
# Once emulator.sh is booting: wait for it, pin its clock, install the debug APK and
# point the app at this worktree's Metro.
#   setup-private.sh [MMDDhhmmYYYY.ss]
# Env: APK (default: this tree's debug APK), METRO_PORT (default: this worktree's
# expo-wt port), QA_TZ (default Asia/Manila).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
DATE="${1:-}"
APK="${APK:-$ROOT/android/app/build/outputs/apk/debug/app-debug.apk}"
METRO_PORT="${METRO_PORT:-$(cd "$ROOT" && bash scripts/expo-wt.sh --port)}"
PKG=$(node -p "require('$ROOT/app.json').expo.android.package")
A=(bash "$HERE/adb.sh")

if [ ! -f "$APK" ]; then
  echo "setup-private: no APK at $APK; build this tree's debug APK first" >&2
  exit 1
fi

booted() {
  [ "$("${A[@]}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}
"${A[@]}" wait-for-device
for _ in $(seq 90); do
  if booted; then
    break
  fi
  sleep 2
done
if ! booted; then
  echo "setup-private: the emulator didn't finish booting; check emulator.sh's output" >&2
  exit 1
fi

"${A[@]}" root >/dev/null
sleep 2
"${A[@]}" wait-for-device
"${A[@]}" shell settings put global auto_time 0
"${A[@]}" shell settings put global auto_time_zone 0
"${A[@]}" shell setprop persist.sys.timezone "${QA_TZ:-Asia/Manila}"
if [ -n "$DATE" ]; then
  "${A[@]}" shell date "$DATE" >/dev/null
fi
"${A[@]}" install -r "$APK" | tail -1

PREFS=$(mktemp)
trap 'rm -f "$PREFS"' EXIT
printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" "<map>" \
  "    <string name=\"debug_http_host\">10.0.2.2:$METRO_PORT</string>" "</map>" > "$PREFS"
"${A[@]}" push "$PREFS" /data/local/tmp/prefs.xml >/dev/null 2>&1
"${A[@]}" shell chmod 644 /data/local/tmp/prefs.xml
"${A[@]}" shell "run-as $PKG sh -c 'mkdir -p shared_prefs && cat /data/local/tmp/prefs.xml > shared_prefs/${PKG}_preferences.xml'"
echo "setup-private: ready, clock $("${A[@]}" shell date | tr -d '\r'), app → Metro :$METRO_PORT"
