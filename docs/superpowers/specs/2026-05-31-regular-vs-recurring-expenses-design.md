# Regular vs Recurring Expenses

**Date:** 2026-05-31  
**Status:** Approved

## TL;DR

Add an `isRecurring` boolean to expenses so users can mark an expense as a regular (one-time) expense or a recurring one. A checkbox in the add/edit form controls this. When unchecked, recurrence picker, due day, and reminder fields are hidden. Non-recurring expenses are auto-marked paid on save (all treated as cash for now — payment type deferred to the accounts feature). The flag is stored as `is_recurring` in SQLite. Existing data defaults to `0`; import/export (`insertWithId`) carries the field so backups round-trip correctly.

## Decisions

- **UI pattern:** Checkbox-style row matching the existing "Variable amount" component — same tappable row with square checkbox, label, and subtitle.
- **Storage:** New `is_recurring INTEGER` column in the `expenses` table.
- **Default for new expenses:** `isRecurring = false` (off by default).
- **Migration:** Add column with `DEFAULT 0` — no backfill. Existing data starts as non-recurring. `insertWithId` updated to carry `is_recurring` so backups round-trip correctly.
- **Due day when non-recurring:** Hidden from form; defaulted to current day-of-month on submit.
- **Recurrence value when non-recurring:** Forced to `'one-off'` on submit regardless of picker state.
- **Auto-paid on add:** Non-recurring expenses always saved with `status='paid'`. Recurring always `'unpaid'`. Payment type deferred to accounts feature.
- **Recurring icon:** `repeat` (Feather) shown on expense card when `isRecurring=true`.

## Data Model

### `types.ts`

Add `isRecurring: boolean` to `Expense`:

```ts
interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number | null;
  dueDay: number;
  recurrence: Recurrence;
  status: Status;
  isVariable: boolean;
  isRecurring: boolean;    // NEW
  notes?: string;
  createdAt: string;
  reminderDaysBefore?: number | null;
}
```

Add `isRecurring: boolean` to `ExpenseFormValues`, rename `monthlyAmount` → `recurringAmount`:

```ts
interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  isVariable: boolean;
  isRecurring: boolean;    // NEW
  recurringAmount: string; // renamed from monthlyAmount
  notes: string;
  reminderDaysBefore: string;
}
```

## DB Schema (`db/schema.ts`)

Add migration after the `reminder_days_before` migration:

```ts
const isRecurringMigrated = await db.getFirstAsync<{ value: string }>(
  "SELECT value FROM prefs WHERE key = 'migrated_expenses_is_recurring_v1'"
);
if (!isRecurringMigrated) {
  await db.execAsync(`ALTER TABLE expenses ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`);
  await db.runAsync(
    "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expenses_is_recurring_v1', '1')"
  );
}
```

Default `0` (not recurring). No backfill.

## DB Helpers (`db/expenses.ts`)

### `getAll`
- Add `is_recurring` to SELECT column list.
- Map: `isRecurring: r.is_recurring === 1`.

### `insert`
- Add `is_recurring` to INSERT column list. Value: `e.isRecurring ? 1 : 0`.
- Auto-paid logic: if `!e.isRecurring`, override `status` to `'paid'` before insert.

### `update`
- Add `is_recurring = ?` to SET clause.

### `insertWithId`
- Add `is_recurring` to INSERT column list. Value: `e.isRecurring ? 1 : 0`.
- Ensures restored backups carry `isRecurring` correctly.

`updateStatus`, `remove` — no changes.

## Form (`app/expense/add.tsx`)

### New checkbox row

Add `isRecurring` checkbox row below the "Variable amount" checkbox, using the identical component pattern:

```
[✓] Recurring expense
    Repeats on a schedule
```

### Conditional field visibility

| Field | Recurring ON | Recurring OFF |
|-------|-------------|---------------|
| Amount | visible | visible |
| Category | visible | visible |
| Due Day | visible | hidden |
| Recurrence picker | visible | hidden |
| Notes | visible | visible |
| Remind me | visible | hidden |

### Default values

- New expense: `isRecurring: false`, `recurrence: 'monthly'` (kept in state but not shown when off).
- Edit expense: derive from `editingExpense.isRecurring`.

### Submit logic

When `isRecurring = false`:
- Force `recurrence = 'one-off'`.
- Force `dueDay = new Date().getDate()` (current day-of-month).
- Force `reminderDaysBefore = null`.
- Force `status = 'paid'`.

When `isRecurring = true`:
- Use form values as-is. Status always `'unpaid'`.

## Expense Card (`components/ExpenseCard.tsx`)

Add a small `repeat` (Feather) icon next to the expense name when `expense.isRecurring === true`, styled with `colors.secondary` at size 12. No icon shown when `isRecurring=false`.

## Context (`context/ExpenseContext.tsx`)

Two `recurrence === 'one-off'` checks replaced with `!expense.isRecurring`:

### `getMonthStatus`
```ts
// Before
if (expense.recurrence === 'one-off') return expense.status;
// After
if (!expense.isRecurring) return expense.status;
```

### `toggleMonthStatus`
```ts
// Before
if (expense.recurrence === 'one-off') { ... }
// After
if (!expense.isRecurring) { ... }
```

## Files Changed

| File | Change |
|------|--------|
| `types.ts` | Add `isRecurring` to `Expense`; add `isRecurring`, rename `monthlyAmount` → `recurringAmount` in `ExpenseFormValues` |
| `db/schema.ts` | Add `is_recurring` migration |
| `db/expenses.ts` | Add `is_recurring` to getAll, insert, update, insertWithId; auto-paid logic in insert |
| `app/expense/add.tsx` | Add recurring checkbox, conditional fields, updated submit logic; rename `monthlyAmount` → `recurringAmount` |
| `context/ExpenseContext.tsx` | Replace `recurrence === 'one-off'` with `!isRecurring` |
| `components/ExpenseCard.tsx` | Add `repeat` Feather icon when `isRecurring=true` |

## Verification

- New non-recurring expense → auto-saved as `status='paid'`, no due day/recurrence/reminder shown.
- New recurring expense → all fields visible, `status='unpaid'`.
- Edit existing monthly expense → checkbox shows checked, all fields visible.
- Edit existing one-off expense → checkbox unchecked, due day + recurrence + reminder hidden.
- Mark paid on non-recurring → flips on expense row (not month table).
- Mark paid on recurring → month table entry created.
- Existing DB data after migration → all have `is_recurring=0`.
- Restore backup with `isRecurring=true` → round-trips correctly.
- Expense card shows `repeat` icon for recurring, none for non-recurring.
