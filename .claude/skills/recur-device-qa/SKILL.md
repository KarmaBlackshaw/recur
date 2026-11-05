---
name: recur-device-qa
description: Use when a recur change needs checking in the running Android app (a test-plan step, "test it on the emulator", "QA this", app screenshots, or SQLite state the UI is slow to reach), and when the shared emulator is busy, re-pinned by another session, or crashes on this tree's native modules.
---

# Recur device QA

Drive the debug app by hand over adb + uiautomator, and judge every step by what the screen shows and what the DB holds. The helpers live in `scripts/` beside this file. From the repo root, set `S=.claude/skills/recur-device-qa/scripts` and call them through `bash` / `python3`.

## Pick the device

| Situation | Use |
|---|---|
| An emulator already runs this worktree's code | Reuse it: `npm run start:wt` (`bash scripts/expo-wt.sh --attach` when Metro already runs). Prefix every helper call with `ANDROID_ADB_SERVER_PORT=5037 ANDROID_SERIAL=<serial from adb devices>`. |
| You need a clean install, another session drives the shared emulator, or its APK crashes (`Fatal signal 11`, `Can't find ViewManager`) | A private emulator (below). The helpers target it by default: `emulator-5602` on its own adb server, port 5099. The shared server never lists it, so nothing installs over it and no tap lands in someone else's app. |

## Private run

1. **APK**: this tree's `android/app/build/outputs/apk/debug/app-debug.apk`. If it's missing or native deps changed, run `npx expo prebuild -p android --no-install`, then in `android/`: `JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a`. It takes about 3 min, and JDK 26 fails in `jlink`.
2. **Metro**: start it as a background command, after your last edit: `npx expo start --port "$(bash scripts/expo-wt.sh --port)" < /dev/null`. Don't use plain `expo-wt`: it SIGTERMs every headless emulator.
3. **Emulator**: start it as its own background command: `bash $S/emulator.sh <avd>`. Pick an AVD that no running emulator uses (`$ANDROID_HOME/emulator/emulator -list-avds`, `ps -axo command | grep qemu-system`). Never `nohup … &` it inside another command: the shell kills it within minutes.
4. **Setup** (foreground): `bash $S/setup-private.sh 110510002026.00`. It waits for boot, pins the clock (`MMDDhhmmYYYY.ss`, Asia/Manila) so a run can't cross midnight, installs the APK and points the app at Metro.
5. **Launch**: `bash $S/adb.sh shell am start -n com.erniejeash.recur/.MainActivity`, then `python3 $S/ui.py wait '^Home$' 120`.
6. **Seed**:
   - Read the live columns first: `bash $S/db.sh ".schema expenses"`. Migrations add columns that `CREATE TABLE` doesn't show.
   - Adapt `seed-example.sql` (`qa-` ids, plus an opening `adjust` row, because debit and cash accounts can't overdraft).
   - Run `bash $S/db.sh --seed <file>`, which force-stops the app, runs the file and relaunches.
7. **Drive** with `ui.py`. After each write, check the rows with `bash $S/db.sh "select …"`.
8. **Teardown**: `bash $S/teardown.sh <metro-port>` (leave out the port if the Metro was already running before you). Make no adb call afterwards: one would restart the private server. A `-read-only` AVD keeps nothing, so for a clean slate, tear down and redo steps 3–6.

## ui.py

| Command | Does |
|---|---|
| `dump [regex]` | Lists visible text/content-desc nodes as `x,y label` (icon glyphs skipped) |
| `has <regex>` / `wait <regex> [s]` | Exits 0 on a match / polls until one appears (default 15 s) |
| `tap <regex> [n]` | Taps the n-th match, then waits 1.2 s |
| `swipe <regex> right\|left` | Swipes a row: right pays a bill, left shows Delete |
| `shot <file.png>` | Takes a screenshot. Save it to the session scratchpad and view it with Read |

- **Regexes** match a row's accessibility label, e.g. `^Water, ` or `^Nov 5, 2026, BPI Savings, ₱400.00$`.
- **Sheets**: a sheet's nodes come after the screen's, so `ui.py dump | sed -n '/Pay Electricity/,$p'` shows the sheet alone.
- **Typing**: tap the field, then `bash $S/adb.sh shell input text 1350`.
- **Clearing a field**: `bash $S/adb.sh shell input keyevent KEYCODE_MOVE_END $(printf 'KEYCODE_DEL %.0s' $(seq 10))`.

## Gotchas

- **Undo** only lasts a few seconds in the snackbar. Chain `ui.py swipe … && ui.py tap '^Undo$'` with nothing in between, then check the DB.
- **A swipe that starts near a screen edge is read as Back** (gesture navigation, about 30 dp). `ui.py swipe` starts 15% in; a hand-written `input swipe` should too.
- **BACK**: the first one drops the keyboard; a second closes the sheet or leaves the app. Dump between BACKs.
- **Emulator gone mid-run** (its output ends `Wait for emulator (pid N) 20 seconds to shutdown gracefully`): another worktree ran `expo-wt`. Redo steps 3–6 and rebuild any state you made through the UI, so keep the APK, seed and date at hand.
- **Old code on screen**: Metro started before your edit, or ran with `CI=1` (no file watcher). Restart Metro and relaunch.
- **"Unable to load script"**: either nothing listens on the pinned Metro port, or the app data was wiped (`pm clear` also wipes `debug_http_host`). Re-run `setup-private.sh`.
- **Hand-quoted `adb shell` commands**: adb re-joins the args for the device shell, so local quotes vanish. Let `db.sh` carry SQL as a file, and quote any other device command as one string.
- **zsh doesn't word-split** a variable holding `adb -s …`; call `adb.sh` instead.
- **Maestro** ignores `ANDROID_ADB_SERVER_PORT`, so it can't reach the private emulator.
