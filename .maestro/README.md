# Maestro e2e flows

End-to-end flows for the Android app. Each top-level flow is independent: it clears app state and
relaunches the app through `subflows/launch-fresh.yaml`.

CI runs the whole suite on every pull request (the `Maestro e2e` job in `.github/workflows/build.yml`):
a release build, which embeds its JS bundle, on an API 34 emulator, so a broken assert fails the PR
that broke it. A failed run uploads its screenshots and logs as the `maestro-debug` artifact.

## Run

Prerequisites: an Android emulator with the debug build installed (`npx expo run:android`), and Metro
running on port 8081.

```sh
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$PATH:$HOME/.maestro/bin:$ANDROID_HOME/platform-tools"

maestro test .maestro                      # whole suite (config.yaml excludes subflows/)
maestro test .maestro/02-card-bill.yaml    # one flow
```

Clearing app state also clears the bundle location set from the dev menu, so a debug build loads from
the Metro port it was built with (`10.0.2.2:8081` on an emulator by default). A release build
(`npx expo run:android --variant release`) needs no Metro, as in CI.

## Flows

| Flow | Covers |
|------|--------|
| `01-credit-card-setup` | Cut-off + due day required for credit cards (Save disabled, the hint names the missing day, days picked from a 1–31 grid); 30/31 accepted |
| `02-card-bill` | Charged badge, overdue estimated bill, statement override + "Use estimate", Pay bill screen prefill, partial ("₱X left") and full payment, badge flips to Paid |
| `03-kpis` | Home month card: Charged row; unpaid card expense counted; Pay from the bill sheet on Recurring; ₱0 bill listed as TBD |
| `04-income` | Deposit-to picker has no credit cards; balance increases; double-tap Save → one entry |
| `05-expense-double-tap` | Double-tap Save on Add Expense → one expense, one debit |
| `06-account-delete` | Deleting an account removes its income from the Income list |
| `07-paid-charged-toggle` | Activity tab Paid / Charged segments list the right rows |
| `08-transfer-no-source` | Pay bill offers only non-credit sources |
| `09-settings` | Notifications off/on and reminder time change without errors |

A flow's `name:` becomes a folder in the debug output, so keep `" : < > | * ?` out of it: the
artifact upload rejects paths containing them.

## Date assumptions

Flows `02`, `03` and `08` backdate a card charge to the 1st of the current month and use a card with
cut-off 1 / due 10, so the bill is overdue. They expect today's day-of-month to be **after the 10th**.
CI pins the emulator clock to 20 Oct 2026, 12:00, so every run sees the same dates.
