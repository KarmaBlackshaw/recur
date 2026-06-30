---
name: paid-date-sort
description: Paid expense lists (Expenses tab + Home Recently Paid) sort desc by real paid date; recurring months gain a paid_at timestamp column
metadata:
  type: project
---

# Paid-date sort + recurring paid_at timestamp

## Summary
Both paid lists now order most-recently-paid first. Recurring expenses had NO stored
paid timestamp (`expense_months` only had status+amount), so a real `paid_at` column was added.

## Changes (dependency chain: types → schema → db → context → screens)
- `types.ts` — `MonthStatus.paidAt?: string | null`
- `db/schema.ts` — migration `migrated_expense_months_paid_at_v1` (`ALTER expense_months ADD paid_at TEXT`). Legacy paid months left NULL.
- `db/expenseMonths.ts` — `getAll` selects `paid_at as paidAt`; `upsertStatus(...,paidAt)` new param; **`upsertMonthlyAmount` preserves `paid_at` via COALESCE subquery** (INSERT OR REPLACE recreates the whole row — without this, editing a variable amount would WIPE the paid timestamp).
- `context/ExpenseContext.tsx` — `monthPaidAts` map; `toggleMonthStatus` writes `new Date().toISOString()` on paid / `null` on unpaid; `SET_MONTH_STATUS` payload carries `paidAt`; exposes `getMonthPaidAt(id,year,month)`.
- `app/(tabs)/expenses.tsx` — sort `paidTime(b)-paidTime(a)` desc. one-off→`paidDate`(?? createdAt); recurring→`getMonthPaidAt` ?? `getDueDateForMonth`.
- `app/(tabs)/index.tsx` — "Recently Paid" window filter + sort use real `paid_at` for recurring via `paidDateOf` helper (?? `getDueDate` fallback).

## Key facts / gotchas
- **`upsertMonthlyAmount` and `upsertStatus` both INSERT OR REPLACE the full row** — any new column must be re-preserved in BOTH or it gets nulled by the other path.
- Legacy paid recurring months have NULL `paid_at` → sort/window fall back to that month's due date until re-marked paid.
- Backup (`utils/backup.ts`) serializes only the `expenses` table, not `expense_months` — schema add was safe, no backup change needed.
- Recurring tab (`app/(tabs)/recurring.tsx`) is a monthly overdue/upcoming/ended grid, still sorts by `dueDay` — intentionally untouched.
- tsc baseline unchanged: 5 errors (global.css TS2882 + DraggableList ×4 under node_modules path).
