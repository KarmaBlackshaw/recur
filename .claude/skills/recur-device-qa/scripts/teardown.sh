#!/usr/bin/env bash
# Stop the private QA emulator and its adb server (and Metro, if you pass the port you
# started it on), by the PIDs listening on their ports.
#   teardown.sh [metro-port]
# Makes no adb call: one would start the private server again.
set -uo pipefail
ADB_PORT="${ANDROID_ADB_SERVER_PORT:-5099}"
SERIAL="${ANDROID_SERIAL:-emulator-5602}"
if [ "$ADB_PORT" = "5037" ]; then
  echo "teardown: 5037 is the shared adb server; refusing" >&2
  exit 1
fi
PORTS=("${SERIAL#emulator-}" "$ADB_PORT" "$@")
listeners() {
  for port in "${PORTS[@]}"; do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null
  done | sort -u
}
PIDS=$(listeners)
if [ -z "$PIDS" ]; then
  echo "teardown: nothing listening on ${PORTS[*]}"
  exit 0
fi
kill $PIDS
for _ in $(seq 30); do
  if [ -z "$(listeners)" ]; then
    echo "teardown: done, nothing left on ${PORTS[*]}"
    exit 0
  fi
  sleep 1
done
echo "teardown: still listening: $(listeners | tr '\n' ' ')" >&2
exit 1
