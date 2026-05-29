# Per-Month Actual Amount

**Date:** 2026-05-29

## TL;DR

Expenses with variable monthly costs (utilities, groceries, etc.) need a way to record what was actually spent each month. This adds an `isVariable` flag to expenses and a per-month actual amount field stored in `expense_months`. Variable expenses show "TBD" by default; users enter the actual amount for each month via the edit screen.

## Problem

- No way to mark an expense as intentionally variable (amount changes each month)
- No mechanism to record the actual amount spent for a given month
- KPI totals currently exclude null-amount expenses entirely (`amount ?? 0`)

## Scope

- `isVariable` boolean flag on `Expense` — set via checkbox on add/edit screen
- Per-month actual amount entry for **variable expenses only**
- Entry point: edit screen (existing card tap flow)
- KPI resolution: monthly actual → base amount → 0
- Month/year filter on KPI is **out of scope** (separate feature)

---

## Data Layer

### `expenses` table migration

Add `is_variable` column:

```sql
ALTER TABLE expenses ADD COLUMN is_variable INTEGER NOT NULL DEFAULT 0;
```

Migration guard key: `'migrated_expenses_is_variable_v1'`

### `expense_months` table migration

Add nullable `amount` column:

```sql
ALTER TABLE expense_months ADD COLUMN amount REAL;
```

Migration guard key: `'migrated_expense_months_amount_v1'`

> **Android note:** Each `ALTER TABLE` must be its own `execAsync` call — never batch with PRAGMA or other DDL.

### Upsert query

Preserve existing status when only writing amount (and vice versa):

```sql
INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount)
VALUES (
  ?, ?, ?,
  COALESCE((SELECT status FROM expense_months WHERE expense_id=? AND year=? AND month=?), 'unpaid'),
  ?
)
```

Same COALESCE pattern in `upsertStatus` — preserve existing `amount`.

### Types (`types.ts`)

```ts
export interface Expense {
  // ...existing fields...
  isVariable: boolean;   // new
}

export interface MonthStatus {
  expenseId: string;
  year: number;
  month: number;
  status: Status;
  amount?: number | null;   // new
}

export interface ExpenseFormValues {
  // ...existing fields...
  isVariable: boolean;      // new
  monthlyAmount: string;    // new — edit screen only
}
```

### DB helpers

**`db/expenses.ts`** — include `is_variable` in `INSERT` and `UPDATE` queries, map to `isVariable` boolean on read.

**`db/expenseMonths.ts`**
- `upsertMonthlyAmount(expenseId, year, month, amount: number | null)` — new, uses COALESCE upsert
- `upsertStatus` — updated to COALESCE upsert preserving `amount`
- `getAll` — include `amount` in SELECT, map to `MonthStatus.amount`

---

## Display Logic

### ExpenseCard amount resolution (variable expenses only)

```
expense.isVariable = true:
  monthlyActual present → show monthlyActual
  else                  → show "TBD"

expense.isVariable = false:
  show expense.amount (existing behavior, never null)
```

### KPI totals (`KpiRow.tsx`)

Per expense:
- `isVariable` + monthly actual present → use monthly actual
- `isVariable` + no monthly actual → 0 (excluded)
- not variable → use `expense.amount`

`getMonthAmount(expenseId, year, month)` exposed from context.

---

## Add/Edit Screen (`add-expense.tsx`)

### Variable checkbox

Below the Amount field (or replacing it when checked):

```
┌─────────────────────────────────────┐
│ Amount                              │
│ [         ₱_______________]         │
│                                     │
│ [✓] Variable (amount changes        │
│     each month)                     │
└─────────────────────────────────────┘
```

- When `isVariable` checked: amount field hidden, base `amount` saved as `null`
- When `isVariable` unchecked: amount field shown normally, required

### This Month section (edit only, variable expenses only)

```
┌─────────────────────────────────────┐
│ THIS MONTH  (May 2026)              │
│                                     │
│ Actual Amount                       │
│ [         ₱_______________]         │
│  Leave blank if not yet known       │
└─────────────────────────────────────┘
```

- Pre-filled if monthly actual already recorded
- Clear → stores `null` (monthly override removed)
- Saved on submit alongside other fields
- Validation: optional, numeric ≥ 0.01 if provided

### Submit logic (edit path)

1. Save expense fields including `isVariable`
2. If `isVariable`: parse `monthlyAmount` → call `upsertMonthlyAmount(id, year, month, parsed | null)`
3. Dispatch `SET_MONTH_AMOUNT` to update in-memory state

---

## Context Changes (`ExpenseContext.tsx`)

### State additions

```ts
monthAmounts: Record<string, number | null>;
// key: monthKey(expenseId, year, month)
```

### New actions

```ts
| { type: 'LOAD_MONTH_AMOUNTS'; payload: MonthStatus[] }
| { type: 'SET_MONTH_AMOUNT'; payload: { expenseId: string; year: number; month: number; amount: number | null } }
```

`LOAD_MONTHS` updated to also populate `monthAmounts` from loaded `MonthStatus[]`.

### New exposed function

```ts
getMonthAmount: (id: string, year: number, month: number) => number | null
```

---

## Dev Tools (settings screen, `__DEV__` only)

New "Developer" section at bottom of `settings.tsx`, visible only when `__DEV__ === true`.

```
┌─────────────────────────────────────┐
│ DEVELOPER                           │
│                                     │
│  🧪  Seed test data          →      │
│  🗑   Clear all data          →      │
└─────────────────────────────────────┘
```

### Seed test data

Seeds 3 months of `expense_months` rows for all current expenses:

- Current month — random paid/unpaid, random amounts for variable expenses
- Last month — all paid, amounts filled for variable expenses
- Two months ago — all paid, amounts filled for variable expenses

Amounts are randomized within a plausible range (₱200–₱5000). Fixed non-variable statuses also seeded.

Implemented as `seedTestData()` in `db/seed.ts` (dev-only file, not imported in production).

### Clear all data

Deletes all rows from `expenses`, `expense_months`, `categories` (custom only), reloads context. Confirmation `Alert` before executing.

---

## Verification

- [ ] Add variable expense (checkbox checked) → amount field hidden, card shows "TBD"
- [ ] Add fixed expense → amount field required, card shows base amount
- [ ] Edit variable expense → "This Month" section visible, amount field hidden
- [ ] Enter monthly actual → card shows that amount instead of "TBD"
- [ ] Clear monthly actual → card reverts to "TBD"
- [ ] Edit fixed expense → no "This Month" section shown
- [ ] KPI excludes variable expenses with no monthly actual
- [ ] KPI includes variable expense monthly actual once entered
- [ ] Toggle paid/unpaid on variable expense → status changes, monthly amount preserved
- [ ] Toggle paid/unpaid on fixed expense → no regression
- [ ] Android: both ALTER TABLE migrations run without NullPointerException
- [ ] Dev Tools section visible in dev build, hidden in production
- [ ] Seed test data → expenses have 3 months of statuses + variable amounts populated
- [ ] Clear all data → confirmation alert shown, DB wiped, list resets to empty
