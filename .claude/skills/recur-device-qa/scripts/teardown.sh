#!/usr/bin/env bash
# Stop the private QA emulator (and Metro, if you pass the port you started it on), then
# its adb server, by the PIDs listening on their ports (SIGTERM, then SIGKILL after 30 s).
# The server goes last: the emulator runs adb itself while shutting down, which would
# start the server again.
#   teardown.sh [metro-port]
# Makes no adb call: one would start the private server again.
set -uo pipefail
ADB_PORT="${ANDROID_ADB_SERVER_PORT:-5099}"
SERIAL="${ANDROID_SERIAL:-emulator-5602}"
if [ "$ADB_PORT" = "5037" ]; then
  echo "teardown: 5037 is the shared adb server; refusing" >&2
  exit 1
fi
listeners() {
  for port in "$@"; do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null
  done | sort -u
}
stop() {
  local pids
  pids=$(listeners "$@")
  if [ -z "$pids" ]; then
    return 0
  fi
  kill $pids
  for signal in TERM KILL; do
    if [ "$signal" = "KILL" ]; then
      # A private adb server can ignore SIGTERM.
      kill -9 $(listeners "$@") 2>/dev/null
    fi
    for _ in $(seq 30); do
      if [ -z "$(listeners "$@")" ]; then
        return 0
      fi
      sleep 1
    done
  done
  echo "teardown: still listening on $*: $(listeners "$@" | tr '\n' ' ')" >&2
  return 1
}
stop "${SERIAL#emulator-}" "$@" && stop "$ADB_PORT" || exit 1
echo "teardown: done, nothing left on ${SERIAL#emulator-} $ADB_PORT $*"
