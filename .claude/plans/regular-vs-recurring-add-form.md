# Regular vs Recurring — Add Form Field Split

**Slug:** regular-vs-recurring-add-form
**Date:** 2026-06-26

## TL;DR

When adding/editing a **regular (non-recurring)** expense, hide the Variable-amount, Due-day, Recurrence, and Remind-me fields — a one-time expense only needs Name, Amount, Category, Notes. Regular vs recurring is derived from the existing `type` param (new) / `recurrence === 'one-off'` (edit) — **no DB migration, no `isRecurring` column, no checkbox**. The recurrence picker drops the "One-off" option (it now exclusively shows Weekly/Monthly/Yearly). Due day is treated as N/A for regular (stored sentinel `1`, never shown).

## Decisions (locked with user)

- Track via existing `type`/`recurrence` split — no new column.
- Recurrence picker: drop "One-off" (recurring = Weekly/Monthly/Yearly only).
- `dueDay`: treat as N/A in UI for regular, **no migration**. Store sentinel `1`; never display.
- Hide for regular: Variable amount, Due day, Recurrence, Remind me.

## ASCII Layout

```
ADD RECURRING (type=recurring / editing weekly|monthly|yearly)   ADD EXPENSE (type=regular / editing one-off)
┌─────────────────────────────────────────┐                     ┌─────────────────────────────────────────┐
│  ‹   Add Recurring Expense              │                     │  ‹   Add Expense                        │
│                                          │                     │                                          │
│  Name *            [ Netflix          ]  │                     │  Name *            [ Groceries        ]  │
│  [✓] Variable amount                     │   ← HIDDEN →        │                                          │
│  Amount            [ 0.00             ]  │                     │  Amount            [ 0.00             ]  │
│  Category          [ Subscriptions  › ]  │                     │  Category          [ Food           › ]  │
│  Due Day (1–31) *  [ 1                ]  │   ← HIDDEN →        │                                          │
│  Recurrence  ( )Weekly (•)Monthly (  )Yr │   ← HIDDEN →        │                                          │
│  Notes             [ …                ]  │                     │  Notes             [ …                ]  │
│  Remind me (days)  [ 1                ]  │   ← HIDDEN →        │                                          │
│  [        Save Expense        ]          │                     │  [        Save Expense        ]          │
└─────────────────────────────────────────┘                     └─────────────────────────────────────────┘
```

Expense paid-log card, regular row — show **logged date** (createdAt) instead of a bogus due date:

```
BEFORE (regular): │ 🍔 Groceries · Food        Jan 1   ₱500 [Paid] │  ← sentinel dueDay leaks
AFTER  (regular): │ 🍔 Groceries · Food       Jun 26   ₱500 [Paid] │  ← createdAt date, never overdue
```

## Implementation Steps

### File 1 — `app/expense/add.tsx`  [med]
1. `RECURRENCE_OPTIONS`: remove the `{ label: "One-off", value: "one-off" }` entry.
2. After `isEditing` is computed, add:
   `const isRegular = isEditing ? editingExpense!.recurrence === "one-off" : type === "regular";`
3. Header title: `isRegular ? (isEditing ? "Edit Expense" : "Add Expense") : (isEditing ? "Edit Recurring Expense" : "Add Recurring Expense")`.
4. Wrap these Controllers in `{!isRegular && ( … )}`: Variable-amount checkbox, Due Day, Recurrence. Wrap the Remind-me Controller **and** its helper caption together in `{!isRegular && (<> … </>)}`.
5. In `onSubmit`, force regular values:
   - `const isVar = isRegular ? false : data.isVariable;`
   - `dueDay: isRegular ? 1 : parseInt(data.dueDay, 10)`
   - `recurrence: isRegular ? "one-off" : data.recurrence`
   - `reminderDaysBefore: isRegular ? null : (data.reminderDaysBefore.trim() === "" ? null : parseInt(data.reminderDaysBefore, 10))`
   - (status auto-paid for one-off is already handled in `db/expenses.ts` insert — leave.)
6. Leave `defaultValues.recurrence` as-is (`type === "regular" ? "one-off" : "monthly"`). Amount/Category/Notes stay always-visible.

### File 2 — `components/ExpenseCard.tsx`  [low]
1. `const isRegular = expense.recurrence === "one-off";`
2. `overdueFlag` → gate with `!isRegular &&` so regular never pulses/flags overdue.
3. Meta date line (the `resolvedStatus === "paid" ? … : …` block): if `isRegular`, render `format(new Date(expense.createdAt), "MMM d")`; else keep existing paid/overdue logic.

## Verification

- Recurring FAB → form shows all fields; picker has only Weekly/Monthly/Yearly; title "Add Recurring Expense".
- Regular FAB → form shows only Name/Amount/Category/Notes; title "Add Expense"; Save enabled once Name filled.
- Save regular → row appears in Expenses tab with `status='paid'`, shows its logged (createdAt) date, no overdue, absent from Recurring tab.
- Save recurring → appears in Recurring tab, `status='unpaid'`, overdue logic intact.
- Edit existing one-off → opens in regular layout (fields hidden); edit existing monthly → recurring layout (all fields).
- `npx tsc --noEmit` shows no **new** errors vs baseline (baseline noise: global.css TS2882, DraggableList SharedValue TS2694 ×4).

## Executor Prompt (self-contained)

> Repo: `/Users/admin/Documents/personal/recur` (React Native / Expo Router, TypeScript, NativeWind v4, react-hook-form). Conventions: NativeWind classes only (no `StyleSheet.create`); `async/await` only; every form field uses RHF `Controller`; icons via `@expo/vector-icons` Feather. **Write code only — do not commit.**
>
> Goal: In the Add/Edit Expense screen, a **regular (non-recurring)** expense must hide the Variable-amount, Due-day, Recurrence, and Remind-me fields. Regular vs recurring is derived: when adding, from the `type` URL param (`type==="regular"` ⇒ regular); when editing, from `editingExpense.recurrence === "one-off"`. No DB changes, no new column, no checkbox.
>
> Two independent files (safe to do in parallel):
> 1. `app/expense/add.tsx` — see Steps under "File 1" above (drop One-off from `RECURRENCE_OPTIONS`; add `isRegular`; conditional-render Variable/DueDay/Recurrence/Remind-me Controllers via `{!isRegular && …}`; force `dueDay:1`, `recurrence:"one-off"`, `isVariable:false`, `reminderDaysBefore:null` for regular on submit; title reflects mode).
> 2. `components/ExpenseCard.tsx` — see "File 2": for `recurrence === "one-off"` rows show `format(new Date(expense.createdAt), "MMM d")` for the meta date and never set `overdueFlag`.
>
> Verify with `npx tsc --noEmit` — no new errors beyond the known baseline (global.css TS2882; DraggableList SharedValue TS2694 ×4).
```
