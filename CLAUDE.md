# Recur — Claude Instructions

## Project

React Native / Expo recurring expenses tracker. Expo Router, TypeScript, NativeWind v4, expo-sqlite, React Context + useReducer (no Zustand), dayjs, react-native-reanimated, @gorhom/bottom-sheet, react-hook-form.

## Stack Conventions

- **Styling:** NativeWind utility classes everywhere. **Never use `StyleSheet.create`** — it is banned. Use inline `style={{}}` only for: (1) Reanimated animated styles, (2) runtime-computed values that can't be expressed as static classes (e.g. dynamic `backgroundColor`, `shadowColor`). Never wrap these in `StyleSheet.create` — plain object inline only. On `overflow-hidden` views, switch a conditional border to `border-0`, never to `""` — Android turns a removed `borderWidth` into NaN insets and clips away every child (#32).
- **State:** `context/ExpenseContext.tsx` is the single source of truth. All mutations go through the context dispatcher after calling the DB helper.
- **DB:** All SQLite access goes through `db/expenses.ts` and `db/categories.ts`. Never query the DB directly from components.
- **Dates:** All date logic uses `dayjs`. No manual date arithmetic. Due is a day-of-month integer (1–31), not a full date string. `getDueDate(dueDay)` clamps to last day of month for short months.
- **Icons:** `@expo/vector-icons` (Ionicons / Feather) only. No emojis as icons. Use `FeatherIconName` (`keyof typeof Feather.glyphMap`, exported from `types.ts`) for all Feather icon name values — never `string`. The only permitted `as FeatherIconName` cast is at external boundaries (SQLite reads, URL params). Import each family from its own entry (`import Feather from "@expo/vector-icons/Feather"`) — the `@expo/vector-icons` barrel bundles all 19 icon fonts. Ionicons render through `components/ui/Ionicon.tsx`, a subset font of the glyphs in `constants/ionicons.ts`: to use a new one, add it there and run `node scripts/subset-fonts.mjs`.
- **Bundle size:** No lodash, ahooks or tailwind-merge — use `utils/collections.ts` and `utils/round.ts` (lodash semantics, pinned by `scripts/collections-check.mjs`), the `utils/use*.ts` hooks, and `utils/mergeClassNames.ts`. Import a package's per-feature entry, never a barrel that re-exports everything. Bank logos are PNGs generated from `assets/banks/*.svg` by `scripts/generate-bank-logos.mjs`. `react-native-svg` is only for drawing charts (`components/ui/AppDonutChart.tsx`).
- **Forms:** `react-hook-form` with `Controller` for every form field. Save button disabled when `!isValid`. Scrollable form screens use `AppFormScrollView` (not a bare `ScrollView`) so the focused field stays above the keyboard — Android is edge-to-edge, so the window never resizes for it. Headers use `AppFormHeader`; dirty forms use `useDiscardGuard` (call `allowLeave()` before navigating away after a save or delete). Show a field's error only once it's touched. Picker rows use `AppSelectField`; dates `AppDateField`, months `AppMonthField`, days of the month `AppDayField` — never a typed date or day number, never an inline `DateTimePicker`.
- **Animations:** `react-native-reanimated` for all animations. No `Animated` API from React Native core.
- **Bottom sheets:** `@gorhom/bottom-sheet` (`BottomSheetModal`). No plain `Modal` for primary flows. Every `BottomSheetModal` passes `accessible={false}` (gorhom's default hides the sheet's controls from screen readers); `AppBottomSheet` already does. Sheets with inputs: content-sized (default dynamic sizing, no fixed `snapPoints`) with `keyboardBehavior="interactive"`, and never `android_keyboardInputMode="adjustResize"` — under edge-to-edge it stops gorhom lifting the sheet, leaving it behind the keyboard. A sheet action whose write changes what the open sheet shows runs through `AppBottomSheet`'s `dismiss(afterDismiss)`, once the sheet has closed: gorhom 5.2.14 otherwise leaves a ghost portal, and the next `present()` does nothing.
- **List rows:** Every money row (expenses, card bills, income, interest, transfers, loans, account transactions) renders through `components/ui/AppListRow.tsx`. No card-wrapped rows, no status pills inside rows. Tones, caption wording and the rest of the visual language live in `DESIGN.md`.
- **No monkey patches:** Never suppress warnings or errors with guards, flags, or workarounds that hide the symptom without fixing the root cause. Always trace to root cause and fix there.
- **Async style:** Always use `async/await`. Never use `.then()` / `.catch()` chains.

## Data Model

```ts
type Recurrence = 'monthly' | 'yearly' | 'one-off';
type Status = 'unpaid' | 'paid';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;        // 1–31, anchor day of month
  recurrence: Recurrence;
  status: Status;        // default: 'unpaid'
  notes?: string;
  createdAt: string;
  startYear?: number | null;  // first month with a cycle; yearly plans recur every year in this month
  startMonth?: number | null; // 0-based. Null for one-off
  endYear?: number | null;    // last month with a cycle. Null = open-ended
  endMonth?: number | null;
}
```

## Business Rules

- Expenses always sorted ascending by `dueDay`.
- A recurring expense only has a cycle in a month when `hasCycleIn(expense, year, month)` (`utils/dateHelpers.ts`): on or after its start month, not past its end month, and for yearly plans only in the start month's calendar month. KPIs, Home Overdue/Upcoming, reminders and the Recurring tab's bands all go through it; months without a cycle show as muted "Not due" rows.
- Overdue = an unpaid cycle whose due date (`getDueDateForMonth`) is before today. Never auto-change status — only show red warning.
- A recurring bill takes part payments: a bill-month holds one or more payment rows (`AccountContext.getPayments`), and the month flips to `paid` once they settle it, recording their sum in `expense_months.amount`, so editing the expense later never rewrites paid history. A fixed bill's month freezes its amount at the first part payment. "Pay part, rest later" can't reach what's left (`canPayPart`; paying all of it is Mark as paid), and a part-paid month stays unpaid, showing what's left (`getBillProgress`). Mark unpaid (button or the row's Unpay swipe) asks first, then reverses every live payment of the month (each stays in the account history with an opposite reversal row; a fixed month's amount clears again, and follows the expense); reverting one payment reopens a settled month. All paying goes through `usePayFlow()`: a bill with a known amount asks to confirm first (an Alert naming the amount, its Pay from account and the month; Cancel writes nothing), then pays (its amount, now, its Pay from account); a bill without one (TBD), or an unpaid bill row tapped on Home or Recurring, opens the Pay sheet, which records the amount, paid-on date and account. A month with no bill pays at ₱0, which writes no account transaction. Every bill payment comes from an account: a bill with none, or whose account is archived or deleted, pays from Cash (`payFromAccountId`). Only a loan lent before Recur has no account. `payMonth`/`unpayMonth` return an undo that restores the month and its payments exactly, offered in the snackbar. Undo of Mark unpaid / Revert a payment deletes the reversal rows, and is refused ("This month changed since. Undo isn't available.") if the month's payments changed since.
- Categories are stored by name on expenses and income, so renaming one renames it on every row. The locked income categories (`LOCKED_INCOME_CATEGORIES`: Overpayment, Transfer) can't be renamed or deleted (`isLockedCategory`) and always list last, in that order (`lockedLast`). Loan overpayments always save under Overpayment, and income earned on a transfer always saves under Transfer (`buildTransferRows`, no picker). `backfillHistory` re-files older transfer income at launch and after a backup import.
- Deleting a recurring expense with paid months warns that its history leaves Activity (payments stay in the balances) and offers setting an end month instead.
- Home Overdue keeps unpaid recurring dues and card bills from the last 3 months (`OVERDUE_LOOKBACK_MONTHS`), so a missed card bill stays until it's paid (`openCardBills` in `utils/cardBills.ts`). A statement already includes the previous bill's unpaid balance and payments clear the oldest bill first, so while an older bill is open a newer one only shows the charges it added.
- Archived accounts (`archived_at`) keep their transactions and still count in net worth, but leave every account picker (`activeAccounts`), card bills, bill reminders and interest. Unarchiving resumes interest from that day. Cash can't be archived. Deleting an account with history offers archiving instead.
- Net worth = account assets + open loan balances ("Lent", the same total as Home's "Owed to you" stat) − card balances owed (`utils/useNetWorth.ts`).
- Debit and cash accounts never go below ₱0. Every write that lowers one (spend, mark paid, lend, transfer + fee, editing or deleting income, editing or deleting a transfer or loan payment, deleting a loan) runs `findOverdraft` (`utils/accounts/findOverdraft.ts`) through `useAccounts().overdraftError`: as the form's inline Amount error, and again in the context before writing. The error offers "Transfer in" (`TransferInButton` under the field, `alertFailure` in Alerts), which opens `/transfer?toAccountId=…&amount=<shortfall>` from the richest other account; forms re-check when balances change, so coming back clears it. Raising a balance is always allowed, so an overdrawn account can still be topped up. Credit cards are exempt.
- A loan lent before Recur has no account (`Loan.accountId` null; the "Existing loan" box on the loan form): saving it writes no `loan_out` and runs no overdraft check (`utils/loans/loanOutChanges.ts`), and checking the box on a saved loan removes its `loan_out`, so the account gets the money back. It still counts in Owed to you and net worth "Lent"; repayments go into an account as usual. A loan whose account was deleted keeps its dangling id and reads "Deleted account", never "Existing loan".
- Reminders are scheduled 12 months ahead, soonest first, capped at 60 pending notifications (iOS allows 64 per app). Every launch reschedules them. `reminderDaysBefore`: null = 1 day before, 0 = off. Notifications name the bill; a single-bill one carries a "Mark paid" action that opens its Pay sheet. Permission is asked after the first recurring bill is saved, never at launch.
- Money lent and repaid is not spending or income: Activity's Paid/Income and its net exclude loan principal (the Loans type lists it), matching net worth, which counts lent money as an asset.
- A borrower's Record payment (`/loan/pay?borrower=`) splits one amount across their active loans oldest first (`lentAt`): each loan is filled to what it owes on the payment date (`maxPaymentOn`) before the next gets anything (`splitLoanPayment`), and it saves one `loan_in` per loan in one write transaction (`loans.recordPayments`). Pay in full settles them all, backdated too: `maxPaymentOn` is the least that settles a loan on that date, since `summarizeLoan` applies payments and monthly interest in date order and stops both at ₱0. A later-dated payment left past that point is flagged (`overpayments`) and shows "₱X more than owed" on the loan page. Paying more than that fills every loan the same way and saves the rest, in the same write, as one income entry (category Overpayment, no picker) linked to the last loan paid. Every income entry carries its loan from `useIncomeEntries` (`utils/usePaidLedger.ts`), so Activity names the borrower and its search finds them, and Stats counts it as income while loan balances ignore it. Deleting that loan deletes the entry, and its confirm counts it; deleting a repayment doesn't. Editing a payment keeps the cap: it can't go above what that loan owes, though a flagged payment can keep what it already overpaid (`canEditPayment`); editing a loan's terms can't grow the overpaid total either (`canChangeLoan`).
- Transfers (and card-bill payments) can be edited and backdated; `updateTransfer` rewrites all of a transfer's rows under the same transfer id.
- Backups (format v9) also carry preferences, account logos and transfer templates. Import runs in one write transaction, so a bad file changes nothing, only fills preferences that aren't set yet, and takes a month's payments only when the device has none for it. A v9 backup carries each transaction's `reversesId` and each loan's `revertedAt`; older files import with them null, and a reversal row is imported only when its original was added by the same import.
- Reversals. Mark unpaid, removing a part payment, Revert transfer / bill payment and Revert loan / loan payment keep the original `account_transactions` row and append a `reversal` row (`reversesId`, opposite amount, links copied, category/note null, dated the later of now and the original). `AccountContext.transactions` is the IN-EFFECT view (no reversal rows, no reversed originals) that consumers read; `ledger` is the raw list, used by the account history page and the account-edit "has history" check, and interest accrual (`runInterest`) reads the raw ledger too, so balance history follows the reversal date. Explicit Delete buttons (income, the `/loan/pay` form's Delete payment and the loan's Delete loan, `/transfer` Delete, Delete expense, Delete account) stay hard deletes and drop any reversal of the deleted rows; edits rewrite only live rows and never create reversals. SQL that replaces, deletes or updates the rows of an expense-month, transfer or loan as part of an edit must append `LIVE_SQL` (`db/accountTransactions.ts`); hard deletes remove the reversals too, through `reverses_id`'s `ON DELETE CASCADE`. A reverted loan stays in `loans` with `revertedAt` (hidden from `LoanContext.loans`; `borrowerOf` still names it).
- Transfer templates (`context/TransferTemplateContext.tsx`, `db/transferTemplates.ts`) prefill a new transfer's From, To, amount, fee, income and note; the date stays today. Picking one drops any account that is archived, deleted or the wrong type, so the field asks again. Managed at `/transfer-templates`, also reached from Settings.
- One-off expenses stay paid permanently.
- KPI totals (Total / Paid / Unpaid) are computed from the in-memory expenses array — no extra DB query.
- Stats (`app/stats.tsx`) is a root-Stack page opened from the "Stats" row at the foot of Activity's hero (`/stats?year&month&period&type`, Activity's month or year and Income/Expenses), pushed with `dangerouslySingular`; it groups money by category for a month or year. Expenses are paid expenses and card charges on their pay/charge date plus fees. Bill payments stay out because the charges already count, and loans stay out because lent money still counts in net worth. Income is income entries, including income earned on a transfer, plus interest net of tax; income a loan brought in gets its own "<category> from loans" slice, apart from bank interest. Loan repayments stay out, so Activity's "Received" can read higher. Slices come from Activity's own rows through `categoryLine` (`utils/activity/categoryLine.ts`): what each row adds to one category (a transfer or bill payment adds only its fee).
- Activity (`app/(tabs)/expenses.tsx`) shows a month or a whole year (Month/Year tabs, `period` param; `usePeriodActivity`). Its header's filter toggle opens `ActivityFilterPanel`, a block under the header that pushes the page down: a keyword, which searches every month; the type (`segment` param: All, Paid, Charged, Income, Transfers, Loans); and a Category row that opens `CategoryFilterSheet` (the categories of the rows it would list, `categoryRows` like Stats' slices, under Income/Expenses tabs). All three combine, closing the panel keeps them, and a badge on the toggle counts them. Picking a category, or tapping a Stats category row (which goes back with `router.dismissTo` and resets the type to All), filters Activity to that category (`category` + `type` params) for the same period: it lists the rows of the type whose `categoryLine` lands in the slice, so with type All its count and total always match the slice. The hero then reads "<category> spent/received this month/year".
- Swipe-to-delete via `react-native-gesture-handler` `Swipeable`. Confirm with `Alert` before deleting. A bill payment (on the bill page), a transfer or a loan repayment (on the account history and the loan page, through `useRevertLoan`) swipes to Revert (`rotate-ccw`) instead of Delete, and its Alert says the history keeps it. Every revert or unpay confirms with an `Alert` (Cancel + a destructive action) before it writes.

## Design Tokens

```
bg:       #161618
surface:  #1C1C1E
primary:  #6366F1
secondary:#818CF8
paid:     #34D399
overdue:  #F87171
text:     #FFFFFF
border:   rgba(255,255,255,0.07)
```

Fonts: Oswald (headings, subset TTFs in `assets/fonts/oswald`, regenerated from `source/` by `scripts/subset-fonts.mjs`) + Quicksand (body), imported per weight from `@expo-google-fonts/quicksand/<weight>`. Quicksand ships unmodified: its license reserves the name, so it can't be subset.

## Folder Structure

```
app/_layout.tsx          # Root: GestureHandlerRootView, BottomSheetModalProvider, fonts
app/+native-intent.tsx   # Rewrites recur://quick-add/<action> (Android widget) to add routes; warm taps push
app/index.tsx            # Main screen
components/              # All UI components
context/ExpenseContext.tsx
db/schema.ts             # initDB() — run once on mount
db/expenses.ts           # getAll, insert, updateStatus, remove
db/categories.ts         # getCustom, insertCustom
utils/dateHelpers.ts     # getDueDate, isOverdue, formatDue
utils/categories.ts      # PRESET_CATEGORIES
utils/collections.ts     # orderBy, groupBy, sumBy… (lodash semantics, no lodash)
constants/theme.ts       # Color tokens (mirrors tailwind.config.js)
constants/quickActions.ts # Quick-action → href map shared by the FAB and the widget
plugins/                 # Local Expo config plugins (android/ and ios/ are generated)
plugins/withQuickAddWidget/ # Android "Quick add" widget: Kotlin provider + res, copied into android/ at prebuild; its URL contract is pinned by scripts/quick-actions-check.mjs
scripts/                 # *-check.mjs logic checks; asset generators (fonts, icons, bank logos)
types.ts                 # Shared TS types
```

## Workflow Rules

- **Always** invoke the `superpowers:using-superpowers` skill at the start of every session before taking any action.
- ⚠️ **Always** invoke the `superpowers:dispatching-parallel-agents` skill (via the Skill tool) before executing ANY plan with 2+ tasks. Never run independent work sequentially. This applies even if tasks look small.
- **Any UI/component work** — invoke `web-component-design` skill before implementation.
- **Any visual/design work** (new screens, redesigns, styling) — invoke `frontend-design` skill before implementation.

## Planning Rules

- Every plan must include ALL of the following sections — **skipping any one is a failure**:
  1. **TL;DR** — 2–3 sentence summary of what's changing and why.
  2. **ASCII layout** — for any UI change, ASCII mockup of the new screen/component. Show before + after. Mandatory for all UI/visual changes.
  3. ⚠️ **Executor prompt** ⚠️ — A self-contained copy-paste prompt with FULL context (repo path, file paths, tech constraints, task list) ready to hand to a fresh executor agent that has zero prior context. **THIS IS MANDATORY. DO NOT SKIP. DO NOT FORGET.** Use `superpowers:dispatching-parallel-agents` for any independent steps inside the prompt.
  4. **Implementation steps** — numbered, with file paths and complexity tags `[low]` / `[med]` / `[high]`.
  5. **Verification** — bullet list of how to confirm the change works end-to-end.
- Default execution: **subagent-driven** (`superpowers:subagent-driven-development`). **Never ask which execution approach to use.** Never present "Option 1 / Option 2" execution choices. Always proceed directly to subagent-driven after plan approval — this overrides any skill that asks for execution preference.
- **Never commit during plan execution.** Write code only. User commits manually.
- After execution is confirmed working, **delete the plan file** from `.claude/plans/`.
- Plan files live at `.claude/plans/<slug>.md`. Never leave stale plans around.

## Preset Categories

Housing, Utilities, Subscriptions, Insurance, Transport, Food, Health, Other
(Users can add custom categories — stored in SQLite `categories` table.)
