# Regular vs Recurring Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `isRecurring` field to expenses so users can distinguish regular (one-off) from recurring expenses, auto-mark non-recurring expenses as paid on add, and display a `repeat` icon on recurring expense cards.

**Architecture:** Add one new column (`is_recurring`) to the SQLite `expenses` table via a guarded migration. `isRecurring` drives form field visibility (due day, recurrence, reminder hidden when off), auto-paid logic on insert (non-recurring always saved as `paid`), and status logic in context. The form uses the existing checkbox-row pattern. ExpenseCard gets a small `repeat` icon badge. `monthlyAmount` renamed to `recurringAmount` throughout.

**Tech Stack:** React Native, Expo Router, expo-sqlite, react-hook-form, NativeWind v4, @expo/vector-icons (Feather), TypeScript.

**Repo:** `/Users/admin/Documents/personal/recur`

---

## File Map

| File | What changes |
|------|-------------|
| `types.ts` | Add `isRecurring` to `Expense` and `ExpenseFormValues`; rename `monthlyAmount` → `recurringAmount` |
| `db/schema.ts` | One new guarded migration: `is_recurring INTEGER DEFAULT 0` |
| `db/expenses.ts` | Add `is_recurring` to `getAll`, `insert`, `update`, `insertWithId`; auto-paid logic in `insert` |
| `app/expense/add.tsx` | Add `isRecurring` checkbox, conditional field visibility, updated submit logic; rename `monthlyAmount` → `recurringAmount` |
| `context/ExpenseContext.tsx` | Replace two `recurrence === 'one-off'` checks with `!expense.isRecurring` |
| `components/ExpenseCard.tsx` | Add `repeat` Feather icon when `expense.isRecurring === true` |

---

## Task 1: Update types

**Files:**
- Modify: `types.ts`

- [ ] **Open `types.ts`** and apply these changes:

```ts
// Update Expense interface — add isRecurring after isVariable:
export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number | null;
  dueDay: number;
  recurrence: Recurrence;
  status: Status;
  isVariable: boolean;
  isRecurring: boolean;     // NEW
  notes?: string;
  createdAt: string;
  reminderDaysBefore?: number | null;
}

// Update ExpenseFormValues — add isRecurring, rename monthlyAmount → recurringAmount:
export interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  isVariable: boolean;
  isRecurring: boolean;     // NEW
  recurringAmount: string;  // renamed from monthlyAmount
  notes: string;
  reminderDaysBefore: string;
}
```

- [ ] **Verify TypeScript compiles** (errors in other files are expected — fixed in later tasks):

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | head -40
```

---

## Task 2: DB migration

**Files:**
- Modify: `db/schema.ts`

- [ ] **Open `db/schema.ts`** and add the migration at the end of `_init()`, after the `reminder_days_before` migration block:

```ts
// Migration: add is_recurring to expenses
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

- [ ] **Verify no syntax errors in schema.ts:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | grep "schema.ts"
```

Expected: no output.

---

## Task 3: Update DB helpers

**Files:**
- Modify: `db/expenses.ts`

- [ ] **Update `getAll`** — add `is_recurring` to SELECT, row type, and mapping:

```ts
export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: string; name: string; category: string; amount: number | null;
    dueDay: number; recurrence: string; status: string; is_variable: number;
    is_recurring: number;
    reminder_days_before: number | null; notes: string | null; createdAt: string;
  }>(
    "SELECT id, name, category, amount, dueDay, recurrence, status, is_variable, is_recurring, reminder_days_before, notes, createdAt FROM expenses ORDER BY dueDay ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: r.amount,
    dueDay: r.dueDay,
    recurrence: r.recurrence as Expense["recurrence"],
    status: r.status as Status,
    isVariable: r.is_variable === 1,
    isRecurring: r.is_recurring === 1,
    reminderDaysBefore: r.reminder_days_before ?? null,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
  }));
}
```

- [ ] **Update `insert`** — add `is_recurring`, auto-paid logic:

```ts
export async function insert(
  e: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const db = await getDB();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  // Non-recurring expenses are always auto-marked paid
  const status = !e.isRecurring ? 'paid' : (e.status ?? 'unpaid');
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, is_recurring, reminder_days_before, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, status, e.isVariable ? 1 : 0, e.isRecurring ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, createdAt]
  );
  return { ...e, id, createdAt, status };
}
```

- [ ] **Update `insertWithId`** — add `is_recurring` for backup restore:

```ts
export async function insertWithId(e: Expense): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR IGNORE INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, is_recurring, reminder_days_before, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.isRecurring ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.createdAt]
  );
}
```

Note: old backups without `isRecurring` will default to `is_recurring=0` via the column default — no explicit fallback needed.

- [ ] **Update `update`** — add `is_recurring` to SET clause:

```ts
export async function update(
  id: string,
  e: Omit<Expense, "id" | "createdAt">
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE expenses SET name=?, category=?, amount=?, dueDay=?, recurrence=?, status=?, is_variable=?, is_recurring=?, reminder_days_before=?, notes=? WHERE id=?`,
    [e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.isRecurring ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, id]
  );
}
```

- [ ] **Verify no TS errors in db/expenses.ts:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | grep "expenses.ts"
```

Expected: no output.

---

## Task 4: Update context

**Files:**
- Modify: `context/ExpenseContext.tsx`

- [ ] **Replace both `recurrence === 'one-off'` checks with `!expense.isRecurring`:**

In `getMonthStatus`, replace:
```ts
if (expense.recurrence === 'one-off') return expense.status;
```
with:
```ts
if (!expense.isRecurring) return expense.status;
```

In `toggleMonthStatus`, replace:
```ts
if (expense.recurrence === 'one-off') {
```
with:
```ts
if (!expense.isRecurring) {
```

- [ ] **Verify no TS errors:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | grep "ExpenseContext.tsx"
```

Expected: no output.

---

## Task 5: Update add/edit form

**Files:**
- Modify: `app/expense/add.tsx`

- [ ] **Update `useForm` default values** — add `isRecurring`, rename `monthlyAmount` → `recurringAmount`:

```ts
const {
  control,
  handleSubmit,
  reset,
  watch,
  formState: { isValid },
} = useForm<ExpenseFormValues>({
  mode: "onChange",
  defaultValues: {
    name: editingExpense?.name ?? "",
    amount: editingExpense?.amount != null ? editingExpense.amount.toString() : "",
    category: editingExpense?.category ?? "Other",
    dueDay: editingExpense?.dueDay?.toString() ?? "1",
    recurrence: editingExpense?.recurrence ?? "monthly",
    isVariable: editingExpense?.isVariable ?? false,
    isRecurring: editingExpense?.isRecurring ?? false,
    recurringAmount: "",
    notes: editingExpense?.notes ?? "",
    reminderDaysBefore: '',
  },
});
```

- [ ] **Add `isRecurringWatched` to the watch call:**

```ts
const isVariableWatched = watch("isVariable");
const isRecurringWatched = watch("isRecurring");
```

- [ ] **Update the `useEffect` reset block** — add `isRecurring`, rename `monthlyAmount` → `recurringAmount`:

```ts
reset({
  name: editingExpense.name,
  amount: editingExpense.isVariable
    ? (existingMonthlyAmount != null ? existingMonthlyAmount.toString() : "")
    : (editingExpense.amount != null ? editingExpense.amount.toString() : ""),
  category: editingExpense.category,
  dueDay: editingExpense.dueDay.toString(),
  recurrence: editingExpense.recurrence,
  isVariable: editingExpense.isVariable,
  isRecurring: editingExpense.isRecurring,
  recurringAmount: "",
  notes: editingExpense.notes ?? "",
  reminderDaysBefore: editingExpense.reminderDaysBefore != null
    ? editingExpense.reminderDaysBefore.toString()
    : '',
});
```

- [ ] **Update `onSubmit`** — add `isRecurring` logic, force status/dueDay/recurrence when non-recurring:

```ts
const onSubmit = handleSubmit(async (data) => {
  const isVar = data.isVariable;
  const isRec = data.isRecurring;
  const parsedAmount = data.amount.trim() !== "" ? parseFloat(data.amount) : null;
  const today = new Date();

  const fields = {
    name: data.name.trim(),
    amount: isVar ? null : parsedAmount,
    category: data.category,
    dueDay: isRec ? parseInt(data.dueDay, 10) : today.getDate(),
    recurrence: isRec ? data.recurrence : ('one-off' as const),
    isVariable: isVar,
    isRecurring: isRec,
    status: editingExpense?.status ?? "unpaid",
    notes: data.notes.trim() || undefined,
    reminderDaysBefore: isRec
      ? (data.reminderDaysBefore.trim() === '' ? null : parseInt(data.reminderDaysBefore, 10))
      : null,
  };

  try {
    if (isEditing && id) {
      await updateExpense(id, fields, isVar ? {
        year: currentYear,
        month: currentMonth,
        amount: parsedAmount,
      } : undefined);
    } else {
      await addExpense(fields, isVar ? {
        year: currentYear,
        month: currentMonth,
        amount: parsedAmount,
      } : undefined);
    }
    reset();
    router.back();
  } catch {
    Alert.alert("Save failed", "Something went wrong. Please try again.");
  }
});
```

- [ ] **Add `isRecurring` checkbox row in JSX** — place it directly below the Variable amount checkbox:

```tsx
{/* Recurring expense checkbox */}
<Controller
  control={control}
  name="isRecurring"
  render={({ field: { value, onChange } }) => (
    <TouchableOpacity
      className="flex-row items-center gap-3 bg-surface border border-border rounded-xl px-3.5 py-3 mb-1 mt-1"
      onPress={() => onChange(!value)}
      accessibilityLabel="Toggle recurring expense"
    >
      <View
        className="w-5 h-5 rounded border-2 items-center justify-center"
        style={{
          borderColor: value ? colors.primary : "rgba(255,255,255,0.25)",
          backgroundColor: value ? colors.primary : "transparent",
        }}
      >
        {value && <Feather name="check" size={12} color="#FFFFFF" />}
      </View>
      <View className="flex-1">
        <AppText variant="body-medium" className="text-white text-sm">Recurring expense</AppText>
        <AppText variant="caption" className="text-white/40 text-xs">Repeats on a schedule</AppText>
      </View>
    </TouchableOpacity>
  )}
/>
```

- [ ] **Wrap Due Day, Recurrence picker, and Remind me + caption with `{isRecurringWatched && (...)}:`**

Due Day:
```tsx
{isRecurringWatched && (
  <Controller
    control={control}
    name="dueDay"
    rules={{
      required: isRecurringWatched,
      validate: (v) => {
        if (!isRecurringWatched) return true;
        const n = parseInt(v, 10);
        return (!isNaN(n) && n >= 1 && n <= 31) || "Must be 1–31";
      },
    }}
    render={({ field: { value, onChange, onBlur } }) => (
      <AppTextInput
        label="Due Day (1–31) *"
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="1"
        keyboardType="number-pad"
        returnKeyType="next"
        maxLength={2}
      />
    )}
  />
)}
```

Recurrence:
```tsx
{isRecurringWatched && (
  <Controller
    control={control}
    name="recurrence"
    render={({ field: { value, onChange } }) => (
      <AppRadioGroup
        label="Recurrence"
        options={RECURRENCE_OPTIONS}
        value={value}
        onChange={onChange}
      />
    )}
  />
)}
```

Remind me + caption:
```tsx
{isRecurringWatched && (
  <>
    <Controller
      control={control}
      name="reminderDaysBefore"
      rules={{
        validate: (v) => {
          if (!isRecurringWatched || !v || v.trim() === '') return true;
          const n = parseInt(v, 10);
          return (!isNaN(n) && n >= 1 && n <= 14) || 'Must be 1–14';
        },
      }}
      render={({ field: { value, onChange, onBlur } }) => (
        <AppTextInput
          label="Remind me (days before)"
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          placeholder="1"
          keyboardType="numeric"
          maxLength={2}
        />
      )}
    />
    <AppText variant="caption" className="text-white/40 text-xs px-1 mb-3">
      Leave blank for default (1 day before due)
    </AppText>
  </>
)}
```

- [ ] **Verify no stray `monthlyAmount` references:**

```bash
grep -n "monthlyAmount" /Users/admin/Documents/personal/recur/app/expense/add.tsx
```

Expected: no output.

- [ ] **Verify no TS errors:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | grep "add.tsx"
```

Expected: no output.

---

## Task 6: Update ExpenseCard

**Files:**
- Modify: `components/ExpenseCard.tsx`

- [ ] **Wrap the expense name `<Text>` in a flex-row and add the `repeat` icon beside it:**

Replace:
```tsx
<Text
  className="text-white text-[15px] font-['Quicksand_700Bold'] mb-0.5"
  numberOfLines={1}
>
  {expense.name}
</Text>
```

With:
```tsx
<View className="flex-row items-center gap-1.5 mb-0.5">
  <Text
    className="text-white text-[15px] font-['Quicksand_700Bold'] flex-shrink"
    numberOfLines={1}
  >
    {expense.name}
  </Text>
  {expense.isRecurring && (
    <Feather name="repeat" size={12} color={colors.secondary} />
  )}
</View>
```

- [ ] **Verify no TS errors:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1 | grep "ExpenseCard.tsx"
```

Expected: no output.

---

## Task 7: Full TS check + smoke test

- [ ] **Full TypeScript check — zero errors:**

```bash
cd /Users/admin/Documents/personal/recur && npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **No remaining `monthlyAmount` in source:**

```bash
grep -rn "monthlyAmount" /Users/admin/Documents/personal/recur --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: no output.

- [ ] **Start dev server and manually verify:**

```bash
cd /Users/admin/Documents/personal/recur && npx expo start --android
```

Smoke test checklist:
- Add non-recurring expense → auto-saved as paid, due day / recurrence / reminder not shown
- Add recurring expense → all fields visible, starts unpaid, `repeat` icon on card
- Edit existing expense → `isRecurring` checkbox state matches saved value
- Existing expenses load without crash (`isRecurring=false` from DB default)
- Export backup → JSON includes `isRecurring` field
- Import backup → expenses restore correctly

---

## Verification Checklist

- [ ] New non-recurring → `status='paid'`, no due day/recurrence/reminder shown
- [ ] New recurring → all fields visible, `status='unpaid'`
- [ ] Edit existing monthly → checkbox checked, all fields visible
- [ ] Edit existing one-off → checkbox unchecked, conditional fields hidden
- [ ] Mark paid on non-recurring → flips on expense row (not month table)
- [ ] Mark paid on recurring → month table entry created
- [ ] Existing DB → all `is_recurring=0` after migration
- [ ] Backup restore with `isRecurring=true` → round-trips correctly
- [ ] Expense card shows `repeat` icon for recurring, none for non-recurring
