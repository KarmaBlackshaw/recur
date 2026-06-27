---
name: recurring-end-date-feature
description: Optional end month for recurring expenses — endYear/endMonth columns, isEndedOn helper, greyed ENDED state + bottom Ended section, excluded from due/overdue/KPI/reminders
metadata:
  type: project
---

# Recurring Expense End Date (End Month)

## What was built
Recurring expenses gained an **optional end month** (year + 0-based month). Active through the end month inclusive; in any month **after** it the expense renders greyed (`opacity 0.5`) with an **ENDED** badge (replaces the paid/unpaid toggle) and is excluded from due/overdue logic, KPI totals, and reminders. Open-ended (no end) = unchanged behavior.

## Data model
- `Expense` gained `endYear?: number | null` + `endMonth?: number | null` (0-based month, matches `getMonthStatus`). `NULL` = open-ended. **Always null for one-off** (forced null in `insert`/`update`).
- `ExpenseFormValues` gained `hasEndDate: boolean` + `endDate: string` (ISO, first-of-end-month).
- Migration `migrated_expense_end_v1`: two separate `execAsync` ALTERs (`ADD COLUMN end_year INTEGER`, `ADD COLUMN end_month INTEGER`) — kept separate per Android SQLite gotcha. No backfill (NULL default = open-ended).

## Key facts / decisions
- **Granularity = end month**, not full date (matches MonthNavigator month-by-month browsing; avoids day-vs-dueDay clamping ambiguity). Form uses `DateTimePicker mode="date"` but stores only year+month as first-of-month ISO; displays `"MMM yyyy"`.
- **"Show as Ended"** chosen over hiding — ended rows still visible but greyed.
- Core predicate: `isEndedOn(endYear, endMonth, year, month)` in `utils/dateHelpers.ts` → true when end set AND viewed (year,month) **strictly after** (endYear,endMonth). Plus `formatEndMonth(endYear, endMonth)` → `"MMM yyyy"`.
- Recurring tab (`app/(tabs)/recurring.tsx`): current-month view splits `currentMonthList` into `activeCurrent` (feeds Overdue/Upcoming/This Month) + `endedNow` (new bottom **"Ended"** section, no accent). Next Month excludes ended-as-of-next-month. Other-month flat list sorts ended rows to the bottom. ExpenseCard does the greyed/ENDED rendering via its `referenceDate`.
- `KpiRow` filters `source` with `!isEndedOn(...)` for the viewed month. `notifications.ts` `continue`s when ended as of the due date's month.
- **No context change** — `ExpenseContext` passes `fields` straight through; new fields are optional on `Expense`.

## Files touched
`types.ts`, `db/schema.ts`, `db/expenses.ts`, `utils/dateHelpers.ts`, `app/expense/add.tsx`, `components/ExpenseCard.tsx`, `app/(tabs)/recurring.tsx`, `components/kpi/KpiRow.tsx`, `utils/notifications.ts`.

## Verification
`npx tsc --noEmit` → only the documented baseline noise (global.css `TS2882` + DraggableList `SharedValue` `TS2694` ×4 = 5 errors). Zero new errors. **Note:** the DraggableList errors contain a node_modules path in their message text, so `grep -v node_modules` hides them — don't mistake that for them being gone.

## Out of scope (YAGNI)
Start date; end for one-offs; hard-delete on end.
