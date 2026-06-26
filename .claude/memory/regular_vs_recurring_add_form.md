---
name: regular-vs-recurring-add-form
description: Add/Edit Expense form hides recurring-only fields for regular (one-off) expenses; derived from type/recurrence, no DB change
metadata:
  type: project
  date: 2026-06-26
  files:
    - app/expense/add.tsx
    - components/ExpenseCard.tsx
---

# Regular vs Recurring — Add Form Field Split

## What was built

When adding/editing a **regular (non-recurring)** expense, the form hides Variable-amount,
Due-day, Recurrence, and Remind-me — leaving only Name / Amount / Category / Notes.

## Key decisions

- **No `isRecurring` column.** Regular vs recurring is *derived*, matching the tabbed-nav design:
  - Adding: `type === "regular"` URL param (FAB passes it).
  - Editing: `editingExpense.recurrence === "one-off"`.
  - `const isRegular = isEditing ? editingExpense!.recurrence === "one-off" : type === "regular";`
- The approved `2026-05-31` `isRecurring`-column spec was **rejected** in favor of this lighter derive-from-recurrence approach (consistent with `2026-06-22` tabbed-nav spec).
- **Recurrence picker dropped "One-off"** — `RECURRENCE_OPTIONS` is now Weekly/Monthly/Yearly only. One-off is set programmatically for regular, never via the picker.
- **`dueDay` stays non-null, no migration.** SQLite column is `INTEGER NOT NULL DEFAULT 1` and can't drop NOT NULL without a table rebuild — too risky on user data. Regular expenses store sentinel `dueDay = 1`; it's never shown (they're filtered out of overdue/upcoming/recurring everywhere, only appear in the Expenses paid-log).
- **Conditional fields via `{!isRegular && (<Controller … />)}`.** Unmounting the `dueDay` Controller (which had `required:true`) also drops its validation rule, so `isValid` isn't blocked for regular — only Name stays required.
- **Submit forces for regular:** `isVariable:false`, `dueDay:1`, `recurrence:"one-off"`, `reminderDaysBefore:null`. Status auto-paid is already handled in `db/expenses.ts` insert (`recurrence==='one-off' → 'paid'`) — not touched.
- **Header title** reflects mode: "Add/Edit Expense" (regular) vs "Add/Edit Recurring Expense".
- **ExpenseCard:** for `recurrence === "one-off"`, show the logged date `format(new Date(expense.createdAt),"MMM d")` instead of a due date, and never set `overdueFlag` (the sentinel dueDay would otherwise leak a bogus date / overdue state in the Expenses paid-log).

## Gotchas

- `notifications.ts` already skips paid expenses (`status !== 'unpaid'`), so regular (auto-paid) never schedules — no change needed there.
- Baseline tsc noise unchanged: `global.css` TS2882 + `DraggableList` SharedValue TS2694 ×4.
