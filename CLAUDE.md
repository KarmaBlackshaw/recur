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
- **Forms:** `react-hook-form` with `Controller` for every form field. Save button disabled when `!isValid`. Scrollable form screens use `AppFormScrollView` (not a bare `ScrollView`) so the focused field stays above the keyboard — Android is edge-to-edge, so the window never resizes for it.
- **Animations:** `react-native-reanimated` for all animations. No `Animated` API from React Native core.
- **Bottom sheets:** `@gorhom/bottom-sheet` (`BottomSheetModal`). No plain `Modal` for primary flows. Sheets with inputs: content-sized (default dynamic sizing, no fixed `snapPoints`) with `keyboardBehavior="interactive"`, and never `android_keyboardInputMode="adjustResize"` — under edge-to-edge it stops gorhom lifting the sheet, leaving it behind the keyboard.
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
- Mark paid on a recurring expense: that month flips to `paid` and records what it cost in `expense_months.amount`, so editing the expense later never rewrites paid history. Unpaying a fixed expense clears it again.
- Categories are stored by name on expenses and income, so renaming one renames it on every row.
- Deleting a recurring expense with paid months warns that its history leaves Activity (payments stay in the balances) and offers setting an end month instead.
- Home Overdue keeps unpaid recurring dues and card bills from the last 3 months (`OVERDUE_LOOKBACK_MONTHS`), so a missed card bill stays until it's paid (`openCardBills` in `utils/cardBills.ts`). A statement already includes the previous bill's unpaid balance and payments clear the oldest bill first, so while an older bill is open a newer one only shows the charges it added.
- Archived accounts (`archived_at`) keep their transactions and still count in net worth, but leave every account picker (`activeAccounts`), card bills, bill reminders and interest. Unarchiving resumes interest from that day. Cash can't be archived. Deleting an account with history offers archiving instead.
- Net worth = account assets + open loan balances ("Lent", the same total as Home's "Owed to you") − card balances owed (`utils/useNetWorth.ts`).
- Debit and cash accounts never go below ₱0. Every write that lowers one (spend, mark paid, lend, transfer + fee, editing or deleting income, deleting a transfer, loan or loan payment) runs `findOverdraft` (`utils/accounts/findOverdraft.ts`) through `useAccounts().overdraftError`: as the form's inline Amount error, and again in the context before writing. The error offers "Transfer in" (`TransferInButton` under the field, `alertFailure` in Alerts), which opens `/transfer?toAccountId=…&amount=<shortfall>` from the richest other account; forms re-check when balances change, so coming back clears it. Raising a balance is always allowed, so an overdrawn account can still be topped up. Credit cards are exempt.
- Reminders are scheduled 12 months ahead, soonest first, capped at 60 pending notifications (iOS allows 64 per app). Every launch reschedules them.
- Backups (format v5) also carry preferences and account logos. Import runs in one write transaction, so a bad file changes nothing, and only fills preferences that aren't set yet.
- One-off expenses stay paid permanently.
- KPI totals (Total / Paid / Unpaid) are computed from the in-memory expenses array — no extra DB query.
- The Stats tab (`app/(tabs)/stats.tsx`) groups money by category for a month or year. Expenses are paid expenses and card charges on their pay/charge date (`usePaidLedger`) plus fees. Bill payments stay out because the charges already count, and loans stay out because lent money still counts in net worth. Income is income entries, including income earned on a transfer, plus interest net of tax; loan repayments stay out, so Activity's "Received" can read higher.
- Swipe-to-delete via `react-native-gesture-handler` `Swipeable`. Confirm with `Alert` before deleting.

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
plugins/                 # Local Expo config plugins (android/ and ios/ are generated)
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
