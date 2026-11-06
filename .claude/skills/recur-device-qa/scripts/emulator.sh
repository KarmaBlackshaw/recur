#!/usr/bin/env bash
# Run a private QA emulator the shared adb server never sees. Long-lived: start it as a
# background command, never with nohup/& inside another one (the shell reaps it).
#   emulator.sh <avd>
set -euo pipefail
export ANDROID_ADB_SERVER_PORT="${ANDROID_ADB_SERVER_PORT:-5099}"
SERIAL="${ANDROID_SERIAL:-emulator-5602}"
if [ "$ANDROID_ADB_SERVER_PORT" = "5037" ]; then
  echo "emulator: 5037 is the shared adb server; use a private port" >&2
  exit 1
fi
SDK="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
exec "$(command -v emulator || echo "$SDK/emulator/emulator")" -avd "$1" \
  -read-only -no-window -no-snapshot -no-audio -port "${SERIAL#emulator-}"
