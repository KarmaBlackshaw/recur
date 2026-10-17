# Accounts / Wallets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. **Never commit** — user commits manually.

**Goal:** Debit/credit/cash accounts with ledger-derived balances, auto-credited debit interest net of tax, transfers/adjusts, expense "Pay from" linkage, and a 2-column Accounts tab.

**Architecture:** Balance = Σ `account_transactions.amount` (no stored balance). New `AccountContext` (Context + useReducer) owns accounts + txns; `ExpenseContext` calls its `syncPayment`/`removePayment` whenever paid state or a one-off changes. Interest math is a pure util, run on app start + foreground.

**Tech Stack:** Expo 56 / RN 0.85, expo-sqlite, NativeWind v4, react-hook-form, @gorhom/bottom-sheet, reanimated, dayjs, lodash per-method, ahooks.

**Spec:** `docs/superpowers/specs/2026-10-17-accounts-wallets-design.md` — executors read it; it is authoritative for behavior and UI.

## TL;DR
Adds an Accounts tab (2-col cards) and per-expense "Pay from" account. Marking an expense paid (or saving a one-off) writes a signed payment transaction; unpaid deletes it. Debit accounts earn annual-rate interest credited daily/monthly/yearly minus withholding tax, caught up on app open. Migrates the reverted July v1 `accounts` table.

## ASCII layout
```
BEFORE                         AFTER
┌──────────────────────┐       ┌──────────────────────────┐
│ Recurring            │       │ Accounts            [+]  │
│ ...                  │       │ ┌ NET WORTH ₱48,210.00 ┐ │
│                      │       │ └ Assets ₱52,300·Owed… ┘ │
│                      │       │ ┌[▣] DEBIT┐┌[$] CASH ┐  │
│                      │       │ │BPI Savi…││Wallet   │  │
│                      │       │ │₱40,000  ││₱2,300   │  │
│                      │       │ │↗+₱104/mo││         │  │
│                      │       │ └─────────┘└─────────┘  │
│                      │       │ ┌[▭]CREDIT┐             │
│                      │       │ │BDO Visa │ OWED ₱4,090 │
│                      │       │ │▓░░ ₱45,910 left·Due 5 │
│ (Hm)(Ex)(Rc)   (+)   │       │ (Hm)(Ex)(Rc)(Ac)  (+)   │
└──────────────────────┘       └──────────────────────────┘
Expense form: new row "Pay from  [BPI Savings ›]" (all recurrences)
```

## Global Constraints
- NativeWind only; no `StyleSheet.create`; inline `style` only for reanimated / runtime values.
- Reanimated only; `BottomSheetModal` for sheets; `react-hook-form` `Controller` per field, save disabled when `!isValid`.
- DB access only in `db/*.ts`; PRAGMA never batched with DDL (Android NPE).
- `async/await` only; braced `if` bodies always; no `any`, no `as` except SQLite-read boundaries (existing pattern); boolean names `is/has/can/should`.
- ₱ formatting via existing `formatAmount` in `utils/dateHelpers.ts`.
- Icons: `@expo/vector-icons` only; card type icons Ionicons `wallet-outline` / `cash-outline` / `card-outline`; tab icon Feather `credit-card`.
- Never use `primary` as text color. Red (`overdue`) only for state, always paired with sign/icon.
- Zero comments by default. Baseline `npx tsc --noEmit` = 0 errors; keep it 0.

## Review Focus
1. Toggle paid → unpaid → paid on the same cycle: exactly one payment txn, balance returns exactly. (Task 4 check)
2. Reopening the app twice the same day credits interest once. (Task 2 check: `from === through` → null)
3. Account with negative balance across the catch-up window earns 0. (Task 2 check)
4. Deleting an account referenced by expenses: expenses show no account, no crash on toggling paid. (Task 3: `account_id` nulled; Task 4: `syncPayment` with null account = delete only)
5. Device with reverted v1 `accounts` table: launch migrates once, relaunch doesn't re-run. (Task 1 manual check)

---

## Implementation steps

### Task 1: Types, schema + migration, DB modules `[med]` — wave 1
**Files:** Modify `types.ts`, `db/schema.ts`, `db/expenses.ts`. Create `db/accounts.ts`, `db/accountTransactions.ts`.

**Produces:**
```ts
// types.ts
export type IoniconName = keyof typeof Ionicons.glyphMap;
export type AccountType = 'debit' | 'credit' | 'cash';
export type InterestPeriod = 'daily' | 'monthly' | 'yearly';
export type TransactionKind = 'payment' | 'interest' | 'tax' | 'transfer' | 'adjust';
export interface Account { id; name; type: AccountType; sortOrder: number;
  interestRate: number | null; interestPeriod: InterestPeriod | null; taxRate: number | null;
  interestAccruedThrough: string | null;   // YYYY-MM-DD
  creditLimit: number | null; statementDay: number | null; dueDay: number | null; createdAt: string }
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'sortOrder' | 'interestAccruedThrough'>;
export interface AccountTransaction { id; accountId; kind: TransactionKind; amount: number;
  expenseId: string | null; cycleYear: number | null; cycleMonth: number | null;
  transferId: string | null; note: string | null; createdAt: string }
// Expense gains: accountId?: string | null;  ExpenseFormValues gains: accountId: string ('' = none)
```
`db/accounts.ts`: `getAll(): Promise<Account[]>` (ORDER BY sort_order, created_at), `insert(input: AccountInput): Promise<Account>` (sort_order = max+1, `interest_accrued_through` = today for debit), `update(id, input)`, `setAccruedThrough(id, date)`, `remove(id)` (in one `withTransactionAsync`: `UPDATE expenses SET account_id=NULL WHERE account_id=?`, rewrite surviving transfer legs' `note` to `Transfer with <name>`, delete account → cascade).
`db/accountTransactions.ts`: `getAll()`, `insert(t: Omit<AccountTransaction,'id'>): Promise<AccountTransaction>`, `insertMany(ts)` (single `withTransactionAsync`), `replacePayment(expenseId, cycleYear|null, cycleMonth|null, t | null)` (delete matching payment via `IFNULL(cycle_year,-1)=IFNULL(?, -1)` then insert if `t`), `removeTransfer(transferId)`, `updatePaymentAmount(expenseId, y, m, amount)`.

- [ ] Add types. Add `accountId` read/write to every `db/expenses.ts` query (`account_id` column; `insert`, `insertWithId`, `update`, `getAll`).
- [ ] `db/schema.ts`, after existing migrations, prefs-gated `migrated_accounts_v2` — exact sequence from spec §"Migrating the reverted v1 schema": detect old table via `PRAGMA table_info(accounts)` lacking `interest_rate` → rename to `accounts_v1`; `CREATE TABLE IF NOT EXISTS accounts` + `account_transactions` + `idx_txn_account` (DDL from spec §Data model, but payment unique index on `(expense_id, IFNULL(cycle_year,-1), IFNULL(cycle_month,-1)) WHERE kind='payment'`); copy v1 rows (`bank`→`debit`, `bill_day`→`statement_day`); drop `accounts_v1`, `account_statements`; `ADD COLUMN account_id TEXT` on expenses only if `PRAGMA table_info(expenses)` lacks it. Each statement its own call. Tables must also be created on fresh installs (CREATE runs regardless of the prefs gate).
- [ ] `npx tsc --noEmit` → 0 errors.

### Task 2: Interest accrual util `[med]` — wave 1 (parallel with Task 1)
**Files:** Create `utils/interest.ts`, `scripts/interest-check.mjs`.

**Produces:**
```ts
export function periodEnds(from: string, today: string, period: InterestPeriod): string[]
// complete periods only: ends strictly after `from` and strictly before `today` (YYYY-MM-DD).
// daily: every day; monthly: each month's last day; yearly: each Dec 31.
export function accrueInterest(a: { rate: number; period: InterestPeriod; taxRate: number;
  from: string; today: string; balanceAt: (dateEnd: string) => number })
  : { gross: number; tax: number; through: string } | null
// null when no complete period. Per end: bal = balanceAt(end) + net accrued so far in this run;
// g = max(bal,0) * rate/100 / (365 | 12 | 1); net += g*(1 - taxRate/100). Unrounded inside loop;
// return gross = round2(Σg), tax = round2(gross − round2(Σnet)), through = last end  (so gross − tax === round2(Σnet)).
```
Only `dayjs` import (no app imports) so node can run it.
- [ ] Write `scripts/interest-check.mjs` importing `../utils/interest.ts` with `node:assert` asserts:
  - 10,000 constant, 4%, daily, 20% tax, `from='2026-01-01'`, `today='2026-02-01'` (complete days Jan 2–31 → assert `periodEnds` length 30) → `round2(gross - tax) === 26.33`, `gross === 32.92`, `through==='2026-01-31'`.
  - `from === yesterday` relative to `today` → `null` (same-day reopen credits nothing).
  - balance −500 → `gross === 0`.
  - monthly: `from='2026-01-15'`, `today='2026-04-02'` → ends `['2026-01-31','2026-02-28','2026-03-31']`.
- [ ] Run `node scripts/interest-check.mjs` → FAIL (module missing). Implement. Re-run → exits 0 silently.

### Task 3: AccountContext `[high]` — wave 2 (after 1, 2)
**Files:** Create `context/AccountContext.tsx`; modify `app/_layout.tsx` (wrap `ExpenseProvider` **inside** `AccountProvider`).

**Produces** `useAccounts()`:
```ts
accounts: Account[]; transactions: AccountTransaction[]; isLoading: boolean;
getBalance(accountId: string): number;        // Σ txns, round2
netWorth: { assets: number; owed: number; net: number };  // assets = debit+cash, owed = credit
monthlyInterestEstimate(account: Account): number; // balance*rate/100/12*(1-tax/100), 0 if not debit/neg
addAccount(input: AccountInput, openingBalance: number): Promise<Account>; // adjust txn if ≠0
updateAccount(id: string, input: AccountInput): Promise<void>;
deleteAccount(id: string): Promise<void>;     // then reload txns (legs' notes changed)
adjustBalance(id: string, target: number): Promise<void>;  // adjust txn of target − current
transfer(fromId: string, toId: string, amount: number, note?: string): Promise<void>;
  // shared transferId; from leg: debit/cash −amount; to leg: debit/cash +amount, credit −amount. from must not be credit (throw).
deleteTransfer(transferId: string): Promise<void>;
syncPayment(p: { expenseId: string; accountId: string | null | undefined; cycleYear: number | null;
  cycleMonth: number | null; amount: number | null; note: string }): Promise<void>;
  // deletes existing payment for (expense, cycle); inserts new one only if accountId exists in accounts && amount != null.
  // sign: credit +amount, else −amount. created_at = now.
removePayment(expenseId: string, cycleYear: number | null, cycleMonth: number | null): Promise<void>;
```
- [ ] Reducer + loader mirroring `ExpenseContext` (`useAsyncEffect`, `useMemoizedFn`).
- [ ] `runInterest()` on mount after load and on `AppState` → `active`: for each debit with rate > 0, `accrueInterest` with `from = interestAccruedThrough ?? createdAt date`, `today = dayjs().format('YYYY-MM-DD')`, `balanceAt` = Σ txns with `created_at <= end 23:59:59.999`. If result: `insertMany([interest +gross, tax −tax])` dated `through` end-of-day, then `setAccruedThrough` — both inside one DB transaction (add `db/accountTransactions.creditInterest(accountId, gross, tax, through)` doing both in `withTransactionAsync`). Guard concurrent runs with a ref.
- [ ] `npx tsc --noEmit` → 0.

### Task 4: Expense ↔ account payment wiring `[high]` — wave 3
**Files:** Modify `context/ExpenseContext.tsx` only.
**Consumes:** `useAccounts().syncPayment`, `.removePayment` (Task 3); `Expense.accountId` (Task 1).
- [ ] `toggleMonthStatus`: after the status write — recurring: next `paid` → `syncPayment({expenseId, accountId: expense.accountId, cycleYear: year, cycleMonth: month, amount: resolveAmount(expense, year, month)-equivalent for that cycle, note: expense.name || expense.category})`; next `unpaid` → `removePayment(id, year, month)`. One-off: same with `null` cycle and `expense.amount`.
- [ ] `addExpense` (one-off only): `syncPayment` null cycle. `updateExpense` (one-off): `syncPayment` with new account/amount (status paid) or `removePayment` if unpaid. `deleteExpense` (one-off): `removePayment`. Recurring delete keeps txns.
- [ ] Monthly-amount setter for a variable expense: if that cycle is paid, `syncPayment` with the new amount.
- [ ] Self-check (Review Focus 1): in dev, toggle paid/unpaid/paid on a recurring expense with a debit account; balance on the Accounts tab returns to the start value and `account_transactions` holds one row for the cycle.

### Task 5: Accounts tab + card grid `[med]` — wave 3 (parallel)
**Files:** Create `app/(tabs)/accounts.tsx`, `components/accounts/AccountCard.tsx`, `components/accounts/NetWorthHero.tsx`. Modify `app/(tabs)/_layout.tsx` (add `accounts` screen), `components/FloatingTabBar.tsx` (`TAB_META.accounts = { label: 'Accounts', icon: 'credit-card' }`, `FAB_TYPE.accounts = 'regular'`).
**Consumes:** `useAccounts()`.
- [ ] Build exactly per spec §UI (grid, odd-count spacer, font-scale>1.3 → 1 col, header `[+]` → `router.push('/account/edit')`, hero, card skeleton, per-type table, states, a11y labels + `accessibilityActions` Adjust/Transfer routing to detail with a param, `EmptyState`). Tap → `/account/${id}`.
- [ ] Invoke `web-component-design` + `frontend-design` skills before building.

### Task 6: Account detail, edit form, Adjust/Transfer sheets `[high]` — wave 3 (parallel)
**Files:** Create `app/account/[id].tsx`, `app/account/edit.tsx` (`?id=` for edit), `components/accounts/AdjustBalanceSheet.tsx`, `components/accounts/TransferSheet.tsx`, `components/accounts/TransactionRow.tsx`.
**Consumes:** `useAccounts()`.
- [ ] Edit form: name, type (`AppRadioGroup`), opening balance (create only), debit: rate % + period radio + tax %; credit: limit, statement day, due day (1–31). Delete in edit with `Alert` confirm.
- [ ] Detail: balance header (credit: owed / limit / available, next statement + due via `getDueDate`), Adjust / Transfer / Edit actions, txn list newest-first grouped by day; transfer rows tappable → confirm → `deleteTransfer`. Kind labels: Payment, Interest, Tax withheld, Transfer, Adjustment.
- [ ] Transfer sheet: from (debit/cash only), to (any other), amount; Adjust sheet: "Set balance to".

### Task 7: Pay-from picker, card meta, backup v2 `[med]` — wave 3 (parallel)
**Files:** Modify `app/expense/add.tsx`, `components/ExpenseCard.tsx`, `utils/backup.ts`. Create `components/AccountPickerSheet.tsx` (wraps `AppSelectBottomSheet`, mirrors `CategoryBottomSheet` ref API `{ present() }`, props `{ value, onChange, onDismiss? }`, includes a "None" option).
- [ ] Form: `accountId` `Controller` row "Pay from" for all recurrences, default `''`; submit maps `'' → null`; edit pre-fills.
- [ ] ExpenseCard: account name as meta when set (via `useAccounts().accounts`).
- [ ] Backup: version 2 adds `accounts`, `transactions`; import accepts 1 and 2; insert-if-id-absent for both (`INSERT OR IGNORE`, add `insertWithId` to both DB modules).

### Wave 4: Central verify
- [ ] `npx tsc --noEmit` → 0; `node scripts/interest-check.mjs` → exit 0; `npx expo export --platform android --output-dir /tmp/recur-export` (bundle builds) ; review diff against spec.

## Verification
- tsc 0 errors; interest check passes; Metro bundle exports.
- Paying/unpaying moves the right account by the right signed amount; toggling twice restores balance.
- One-off with account charges on save; edit amount re-syncs; delete refunds.
- Transfer debit → credit lowers both; overdraw / over-limit red, not blocked.
- Old v1 accounts appear (bank→debit, balance 0) once; relaunch no re-run.
- Backup v1 still imports; v2 round-trips accounts + txns.
- Device: 4-tab label fits at 360dp; grid odd-count spacer; large font → 1 column.

## Executor prompt
```
Repo: /Users/admin/orca/workspaces/recur/remora (Expo 56 / RN 0.85, TypeScript, Expo Router,
NativeWind v4, expo-sqlite, React Context + useReducer, dayjs, reanimated, @gorhom/bottom-sheet,
react-hook-form, lodash per-method, ahooks). Read CLAUDE.md, the spec
docs/superpowers/specs/2026-10-17-accounts-wallets-design.md, and this plan
.claude/plans/accounts-wallets.md. Implement ONLY your assigned Task N, honoring its Files,
Interfaces and Global Constraints. Do not edit files owned by other tasks. Never commit.
Zero comments unless a competent dev would otherwise ship a bug. Run `npx tsc --noEmit`
(must stay 0 errors outside node_modules) before reporting; report files changed + checks run.
Waves: 1 = Tasks 1,2 (parallel) → 2 = Task 3 → 3 = Tasks 4,5,6,7 (parallel, use
superpowers:dispatching-parallel-agents) → 4 = central verify.
```
