---
name: home-recent-paid-date
description: Home "Recently Paid — Last 7 days" section + new paid_date column for one-off expenses — schema, dating logic, gotchas
metadata:
  type: project
  date: 2026-06-26
---

# Home Recent Section + paidDate field

Home (`app/(tabs)/index.tsx`) is a `SectionList` with three computed sections (all in one `useMemo`): **Overdue** (red), **Upcoming — Next 7 Days** (indigo), **Recently Paid — Last 7 Days** (green). Earlier this replaced a single alert-card link to `/recurring`.

## Recent section dating
- Window = `[addDays(today, -7), today]` inclusive.
- **Recurring** items: shown if `getMonthStatus(id, year, month) === "paid"` AND `getDueDate(dueDay)` (current month) is in-window. Anchored on **due date** — there is no per-month paid timestamp (expense_months has no day/timestamp).
- **One-offs**: shown if `status === "paid"` AND `paidDate` parses in-window. Anchored on the new `paidDate`.
- Sorted by effective date DESC (most recent first). No overlap with Overdue/Upcoming (paid-vs-unpaid + window are disjoint).

## New `paidDate` field (one-offs)
- `Expense.paidDate?: string | null` (ISO). Recurring always null; one-offs carry it.
- DB column `paid_date TEXT` on `expenses`. Migration key `migrated_paid_date_v1` (ALTER + backfill existing paid one-offs from `createdAt`). DDL kept in its own `execAsync` per the Android PRAGMA/DDL gotcha.
- `db/expenses.ts`: `getAll` selects/maps `paid_date`; `insert` defaults one-off `paidDate` to today (`createdAt`), forces null for recurring; `insertWithId` + `update` persist it (`update` also nulls it for recurring).
- Form (`app/expense/add.tsx`): "Paid Date" Controller field, **one-off only** (`{isRegular && ...}`), uses `@react-native-community/datetimepicker` (was installed, previously unused). Default today, `maximumDate={new Date()}`, writes `startOfDay(date).toISOString()`. Wired into defaultValues, the edit `reset()`, and `onSubmit` fields (`paidDate: isRegular ? data.paidDate : null`).

## Known gaps / follow-ups (not done — out of scope)
- **Expenses tab still anchors paid one-offs to `createdAt`-month**, not `paidDate` → minor inconsistency vs Home.
- One-off `ExpenseCard` shows the dueDay anchor ("Mon 1"), not `paidDate`. Could surface paidDate on the card.
- A one-off paid early / recurring pre-paid (due date still future) won't appear in Recent (due-date anchor limitation for recurring).

## Verification
- `npx tsc --noEmit` clean except the 5 baseline errors (global.css TS2882 + DraggableList TS2694 ×4).
- Runtime (date picker dialog on Android + migration on-device) NOT yet verified.
