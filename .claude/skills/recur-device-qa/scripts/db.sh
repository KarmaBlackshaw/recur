#!/usr/bin/env bash
# SQL against the app's expo-sqlite DB on the QA target (debug builds only: uses run-as).
#   db.sh "select …;"         query or tweak (the app can stay open; it won't see writes until relaunched)
#   db.sh --seed seed.sql     force-stop the app, run the file, relaunch
# The SQL travels as a pushed file, so it needs no shell quoting.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
PKG=$(node -p "require('$ROOT/app.json').expo.android.package")
A=(bash "$HERE/adb.sh")
SQL=$(mktemp)
trap 'rm -f "$SQL"' EXIT

SEED=false
if [ "${1:-}" = "--seed" ]; then
  SEED=true
  cat "$2" > "$SQL"
else
  printf '%s\n' "$1" > "$SQL"
fi

"${A[@]}" push "$SQL" /data/local/tmp/qa.sql >/dev/null 2>&1
"${A[@]}" shell chmod 644 /data/local/tmp/qa.sql
if $SEED; then
  "${A[@]}" shell am force-stop "$PKG"
fi
"${A[@]}" shell "run-as $PKG sh -c 'sqlite3 -header files/SQLite/recur.db < /data/local/tmp/qa.sql'"
if $SEED; then
  "${A[@]}" shell am start -n "$PKG/.MainActivity" >/dev/null
fi
