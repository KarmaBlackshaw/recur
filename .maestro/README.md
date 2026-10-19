# Maestro e2e flows

End-to-end flows for the Android debug build (expo dev client). Each top-level flow is independent: it
clears app state and loads the bundle from Metro through `subflows/launch-fresh.yaml`.

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

`launch-fresh.yaml` opens the dev client at `http://192.168.0.115:8081`. If your machine has a different
LAN IP, edit the URL there, or use `adb reverse tcp:8081 tcp:8081` and
`http%3A%2F%2Flocalhost%3A8081`.

## Flows

| Flow | Covers |
|------|--------|
| `01-credit-card-setup` | Cut-off + due day required for credit cards (Save disabled, 1–31 range); 30/31 accepted |
| `02-card-bill` | Charged badge, overdue bill with "Est.", statement override + "Use estimate", Pay bill prefill, partial ("₱X left") and full payment, badge flips to Paid |
| `03-kpis` | 2×2 KPI grid values; unpaid card expense in Total/To pay; ₱0 bill hidden on Home |
| `04-income` | Deposit-to picker has no credit cards; balance increases; double-tap Save → one entry |
| `05-expense-double-tap` | Double-tap Save on Add Expense → one expense, one debit |
| `06-account-delete` | Deleting an account removes its income from the Income list |
| `07-paid-charged-toggle` | Activity tab Paid / Charged segments list the right rows |
| `08-transfer-no-source` | Pay bill offers only non-credit sources |
| `09-settings` | Notifications off/on and reminder time change without errors |

## Date assumptions

Flows `02`, `03` and `08` backdate a card charge to the 1st of the current month and use a card with
cut-off 1 / due 10, so the bill is overdue. They expect today's day-of-month to be **after the 10th**.
