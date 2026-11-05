#!/usr/bin/env bash
# adb against the QA target: the private emulator (emulator-5602 on adb server 5099)
# unless ANDROID_SERIAL / ANDROID_ADB_SERVER_PORT say otherwise.
export ANDROID_ADB_SERVER_PORT="${ANDROID_ADB_SERVER_PORT:-5099}"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5602}"
exec "$(command -v adb || echo "${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}/platform-tools/adb")" "$@"
