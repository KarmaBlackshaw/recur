#!/bin/bash
EMULATOR=/opt/homebrew/share/android-commandlinetools/emulator/emulator

# Worktree emulators (<repo>_wt_<worktree>) belong to `npm run start:wt` in their own checkout.
avds=$("$EMULATOR" -list-avds 2>/dev/null | grep -v '_wt_')

if [ -z "$avds" ]; then
  echo "No AVDs found."
  exit 1
fi

echo "Found AVDs:"
echo "$avds"
echo ""

while IFS= read -r avd; do
  echo "Cold booting: $avd"
  "$EMULATOR" -avd "$avd" -no-snapshot-load &
done <<< "$avds"
