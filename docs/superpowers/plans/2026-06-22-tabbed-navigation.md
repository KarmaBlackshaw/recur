# Tabbed Navigation (Home / Expenses / Recurring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-screen app with a 3-tab layout (Home / Expenses / Recurring) behind an expo-router `(tabs)` group, using a custom themed floating tab bar with an inline context-aware FAB.

**Architecture:** Add `app/(tabs)/_layout.tsx` rendering `<Tabs>` with a custom `FloatingTabBar`. Move today's `app/index.tsx` logic into `app/(tabs)/recurring.tsx` (recurring-only, no greeting). Add a new slim `app/(tabs)/index.tsx` (Home dashboard) and `app/(tabs)/expenses.tsx` (paid log). Modal routes (`expense/add`, `settings`) stay in the parent Stack so they cover the tab bar. Regular vs recurring is derived from the existing `recurrence` field; one-off expenses are auto-paid on insert.

**Tech Stack:** React Native 0.85, Expo ~56, expo-router ~56, NativeWind v4, react-native-reanimated, @gorhom/bottom-sheet, react-native-safe-area-context, TypeScript.

## Global Constraints

- **Styling:** NativeWind utility classes only. **Never** `StyleSheet.create`. Inline `style={{}}` only for Reanimated styles or runtime-computed values (dynamic `backgroundColor`/`shadowColor`/safe-area offsets) — plain object, never wrapped in `StyleSheet.create`.
- **Icons:** `@expo/vector-icons` Feather only. Icon name values typed as `FeatherIconName` (from `types.ts`), never `string`.
- **Async:** `async/await` only. No `.then()`/`.catch()`.
- **State/DB:** All DB access via `db/*` helpers; all mutations via `ExpenseContext`. Never query DB from components.
- **Color tokens:** import `colors` from `constants/theme.ts` (`background #161618`, `surface #1C1C1E`, `primary #6366F1`, `secondary #818CF8`, `paid #34D399`, `overdue #F87171`). Use existing Tailwind classes (`bg-background`, `bg-surface`, `bg-primary`, `text-overdue`, `bg-white/[0.07]`, etc.).
- **No tests in repo / no test runner.** Per-task gate = `npx tsc --noEmit` passes with no NEW errors. Do **not** add jest/testing-library (YAGNI).
- **No commits.** Write code only — the user commits manually. Do not run `git commit`.
- Expenses sort ascending by `dueDay`. One-off expenses anchored to their `createdAt` month.

---

## TL;DR

Single screen → three tabs. **Recurring** = current home minus greeting, recurring-only, FAB adds recurring. **Expenses** = month-pickered paid log (paid recurring + paid one-offs), FAB adds regular. **Home** = new slim dashboard (greeting + settings + totals + overdue/due-soon line), FAB adds regular. Floating pill tab bar `[ Home | Expenses | Recurring ]` + inline circular `+`. One-offs auto-paid on insert.

## ASCII Layout (before → after)

**BEFORE — single screen (`app/index.tsx`):**
```
┌──────────────────────────────────┐
│ FRI, JUN 20      Good evening [⚙] │  greeting header
│ ‹ June 2026 ›                     │  month nav
│ [Total][Paid][Unpaid]             │  KPIs (all expenses)
│ OVERDUE / UPCOMING / THIS / NEXT  │  sectioned list (incl one-offs)
│                              (＋)  │  absolute FAB
└──────────────────────────────────┘
```

**AFTER — three tabs + floating bar:**
```
HOME (tabs/index)          EXPENSES (tabs/expenses)     RECURRING (tabs/recurring)
┌────────────────────┐     ┌────────────────────┐       ┌────────────────────┐
│ FRI,JUN20  Hi  [⚙] │     │   ‹ June 2026 ›    │       │   ‹ June 2026 ›    │
│ This Month         │     │ Paid this mo $820  │       │ [Total][Paid][Unpd]│ recurring-only
│ [Total][Paid][Unpd]│     │ ───────────────    │       │ OVERDUE            │
│ ⚠ 2 overdue ·3 soon│     │ Netflix    $15  ✓  │       │ UPCOMING / THIS /  │
│   → tap to Recurring│     │ Rent      $900  ✓  │       │ NEXT               │
└────────────────────┘     └────────────────────┘       └────────────────────┘
   ╭────────────────────────────╮  ╭────╮
   │  ⌂Home  ✓Expenses ⟳Recur   │  │ ＋ │   ← floating bar, shared across tabs
   ╰────────────────────────────╯  ╰────╯      FAB action varies by active tab
```

## ⚠️ Executor Prompt (self-contained — copy-paste to a fresh agent) ⚠️

> You are working in the React Native / Expo app at `/Users/admin/Documents/personal/recur`. Stack: Expo Router ~56, React Native 0.85, NativeWind v4, expo-sqlite, React Context + useReducer, date-fns, TypeScript. **Conventions (hard rules):** NativeWind classes only — NEVER `StyleSheet.create`; inline `style={{}}` only for Reanimated or runtime-computed values (plain object). Feather icons only, typed `FeatherIconName` from `types.ts`. `async/await` only. DB only via `db/*`; mutations only via `context/ExpenseContext.tsx`. Import color tokens from `constants/theme.ts`. There is NO test runner — do not add one; verify each task with `npx tsc --noEmit` (no new errors). DO NOT run `git commit` — the user commits manually.
>
> Implement the task assigned to you from `docs/superpowers/plans/2026-06-22-tabbed-navigation.md` EXACTLY as written (full code is provided per task). Touch ONLY the files listed under your task's **Files**. Do not edit any other file. When done, run `npx tsc --noEmit` and report the result plus a one-line summary of what you changed.

## Implementation Steps (complexity-tagged)

Wave 1 (parallelizable — disjoint files): Task 1 `[low]`, Task 2 `[low]`, Task 3 `[med]`, Task 4 `[med]`, Task 5 `[med]`, Task 6 `[med]`.
Wave 2 (after Wave 1): Task 7 `[med]`.

1. `[low]` **Task 1** — `db/expenses.ts`: auto-pay one-off in `insert`.
2. `[low]` **Task 2** — `app/expense/add.tsx`: read `type` param, set default recurrence.
3. `[med]` **Task 3** — `components/FloatingTabBar.tsx`: new floating tab bar + context FAB.
4. `[med]` **Task 4** — `app/(tabs)/recurring.tsx` (new, ported) + `components/kpi/KpiRow.tsx` (add `recurringOnly` prop).
5. `[med]` **Task 5** — `app/(tabs)/expenses.tsx`: new paid log.
6. `[med]` **Task 6** — `app/(tabs)/index.tsx`: new Home dashboard.
7. `[med]` **Task 7** — `app/(tabs)/_layout.tsx` (new) + delete `app/index.tsx`.

---

### Task 1: Auto-pay one-off on insert `[low]`

**Files:**
- Modify: `db/expenses.ts` (the `insert` function only)

**Interfaces:**
- Produces: insert behavior — any expense with `recurrence === 'one-off'` is persisted and returned with `status: 'paid'`, regardless of the passed status. `insertWithId` is untouched.

- [ ] **Step 1:** In `db/expenses.ts`, replace the `insert` function body so the status is computed once and reused. New `insert`:

```ts
export async function insert(
  e: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const db = await getDB();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  // Regular (one-off) expenses represent money already spent → auto-paid.
  const status: Status = e.recurrence === "one-off" ? "paid" : (e.status ?? "unpaid");
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, createdAt]
  );
  return { ...e, id, createdAt, status };
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** A one-off insert returns `status: 'paid'`; a monthly insert returns the passed status (default `'unpaid'`).

---

### Task 2: `type` param in add form `[low]`

**Files:**
- Modify: `app/expense/add.tsx` (params destructure + `defaultValues.recurrence` only)

**Interfaces:**
- Consumes: URL param `type` ∈ `'regular' | 'recurring'` (from FAB in Task 3 / EmptyState in Tasks 4 & 6).
- Produces: when NOT editing, the form's default recurrence = `one-off` if `type==='regular'`, else `monthly`. Picker stays visible/editable.

- [ ] **Step 1:** Add `type` to the params destructure (around line 29):

```tsx
const { id, year: yearParam, month: monthParam, type } = useLocalSearchParams<{
  id?: string;
  year?: string;
  month?: string;
  type?: "regular" | "recurring";
}>();
```

- [ ] **Step 2:** Change the `recurrence` default value (currently `editingExpense?.recurrence ?? "monthly"`) to:

```tsx
recurrence: editingExpense?.recurrence ?? (type === "regular" ? "one-off" : "monthly"),
```

- [ ] **Step 3:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** Opening `/expense/add?type=regular` defaults the recurrence radio to "One-off"; `?type=recurring` (or no param) defaults to "Monthly"; editing an existing expense is unaffected.

---

### Task 3: FloatingTabBar `[med]`

**Files:**
- Create: `components/FloatingTabBar.tsx`

**Interfaces:**
- Consumes: `BottomTabBarProps` from `@react-navigation/bottom-tabs` (transitive dep of expo-router). Route names: `index`, `expenses`, `recurring`.
- Produces: `export function FloatingTabBar(props: BottomTabBarProps)`. FAB pushes `/expense/add?type=regular` on Home/Expenses, `?type=recurring` on Recurring.

- [ ] **Step 1:** Create `components/FloatingTabBar.tsx`:

```tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "../constants/theme";
import type { FeatherIconName } from "../types";

const TAB_META: Record<string, { label: string; icon: FeatherIconName }> = {
  index: { label: "Home", icon: "home" },
  expenses: { label: "Expenses", icon: "check-circle" },
  recurring: { label: "Recurring", icon: "repeat" },
};

const FAB_TYPE: Record<string, "regular" | "recurring"> = {
  index: "regular",
  expenses: "regular",
  recurring: "recurring",
};

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name ?? "index";

  function handleAdd() {
    const type = FAB_TYPE[activeName] ?? "regular";
    router.push(`/expense/add?type=${type}`);
  }

  return (
    <View
      className="absolute left-0 right-0 flex-row items-center gap-3 px-4"
      style={{ bottom: insets.bottom + 12 }}
      pointerEvents="box-none"
    >
      {/* Tab pill */}
      <View
        className="flex-1 flex-row items-center bg-surface rounded-full py-2 px-1.5 border border-white/[0.07]"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const color = focused ? colors.secondary : "rgba(255,255,255,0.4)";

          function onPress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              className="flex-1 items-center py-1.5"
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
            >
              <Feather name={meta.icon} size={19} color={color} />
              <Text
                className="text-[10px] mt-1 tracking-wide"
                style={{ color, fontFamily: "Quicksand_700Bold" }}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Inline FAB */}
      <TouchableOpacity
        onPress={handleAdd}
        activeOpacity={0.85}
        className="size-14 rounded-full bg-primary items-center justify-center"
        accessibilityLabel="Add expense"
        style={{
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: no new errors. If `@react-navigation/bottom-tabs` types do not resolve, fall back to typing the param as `any` (`export function FloatingTabBar({ state, navigation }: any)`) and note it in your report.

**Verify:** Component compiles; exports `FloatingTabBar`; active tab uses `colors.secondary`, inactive `rgba(255,255,255,0.4)`.

---

### Task 4: Recurring tab + KpiRow `recurringOnly` `[med]`

**Files:**
- Create: `app/(tabs)/recurring.tsx`
- Modify: `components/kpi/KpiRow.tsx` (add optional `recurringOnly` prop — additive, backward compatible)
- Read-only reference (do NOT edit): `app/index.tsx` (this is the source being ported)

**Interfaces:**
- Consumes: `useExpenses()`, `ExpenseCard`, `MonthNavigator`, `EmptyState`, `KpiRow`.
- Produces: default-export `RecurringScreen`. `KpiRow` gains `recurringOnly?: boolean` (default `false`).

- [ ] **Step 1:** In `components/kpi/KpiRow.tsx`, extend `Props` and filter the source list. Change the interface and the `useExpenses` line:

```tsx
interface Props {
  year: number;
  month: number;
  recurringOnly?: boolean;
}

export function KpiRow({ year, month, recurringOnly = false }: Props) {
  const { expenses, getMonthAmount, getMonthStatus } = useExpenses();
  const source = recurringOnly
    ? expenses.filter((e) => e.recurrence !== "one-off")
    : expenses;
  // ...existing resolveAmount unchanged...
  const resolvedExpenses = source.map((e) => ({
    ...e,
    status: getMonthStatus(e.id, year, month),
  }));
  // ...rest unchanged (total/paid/unpaid + JSX)...
}
```

(Only the `Props` interface, the destructure, and replacing `expenses.map` with `source.map` change. Everything else in the file stays.)

- [ ] **Step 2:** Create `app/(tabs)/recurring.tsx`:

```tsx
import React, { useMemo, useState } from "react";
import { View, Text, SectionList, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { isWithinInterval, addDays, startOfToday } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { KpiRow } from "../../components/kpi/KpiRow";
import { MonthNavigator } from "../../components/MonthNavigator";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
  referenceDate?: Date;
}

export default function RecurringScreen() {
  const { expenses, loading, getMonthStatus } = useExpenses();
  const today = startOfToday();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  const recurringExpenses = useMemo(
    () => expenses.filter((e) => e.recurrence !== "one-off"),
    [expenses]
  );

  const { sections, flatList } = useMemo(() => {
    const resolveStatus = (e: Expense, year: number, month: number): Expense =>
      ({ ...e, status: getMonthStatus(e.id, year, month) });

    if (!isCurrentMonth) {
      const list = recurringExpenses
        .map((e) => resolveStatus(e, selectedYear, selectedMonth))
        .sort((a, b) => a.dueDay - b.dueDay);
      return { sections: [], flatList: list };
    }

    const in30 = addDays(today, 30);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthVal = currentMonth === 11 ? 0 : currentMonth + 1;
    const currentMonthRef = new Date(currentYear, currentMonth, 1);
    const nextMonthRef = new Date(nextMonthYear, nextMonthVal, 1);

    const currentMonthList = recurringExpenses.map((e) => resolveStatus(e, currentYear, currentMonth));
    const nextMonthList = recurringExpenses.map((e) => resolveStatus(e, nextMonthYear, nextMonthVal));

    const overdue = currentMonthList
      .filter((e) => e.status === "unpaid" && isOverdueOn(e.dueDay, currentYear, currentMonth))
      .sort((a, b) => a.dueDay - b.dueDay);
    const upcoming = currentMonthList
      .filter((e) => {
        const d = getDueDate(e.dueDay);
        return (
          isWithinInterval(d, { start: today, end: in30 }) &&
          !isOverdueOn(e.dueDay, currentYear, currentMonth)
        );
      })
      .sort((a, b) => a.dueDay - b.dueDay);

    const shownIds = new Set([...overdue, ...upcoming].map((e) => e.id));
    const thisMonthExpenses = currentMonthList
      .filter((e) => !shownIds.has(e.id))
      .sort((a, b) => a.dueDay - b.dueDay);
    const nextMonthExpenses = [...nextMonthList].sort((a, b) => a.dueDay - b.dueDay);

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", data: overdue, accent: colors.overdue, referenceDate: currentMonthRef });
    }
    if (upcoming.length > 0) {
      result.push({ title: "Upcoming — Next 30 Days", data: upcoming, accent: colors.secondary, referenceDate: currentMonthRef });
    }
    if (thisMonthExpenses.length > 0) {
      result.push({ title: "This Month", data: thisMonthExpenses, referenceDate: currentMonthRef });
    }
    if (nextMonthExpenses.length > 0) {
      result.push({ title: "Next Month", data: nextMonthExpenses, referenceDate: nextMonthRef });
    }
    return { sections: result, flatList: [] };
  }, [recurringExpenses, getMonthStatus, selectedYear, selectedMonth, isCurrentMonth]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.secondary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
      />

      {recurringExpenses.length > 0 && (
        <KpiRow year={selectedYear} month={selectedMonth} recurringOnly />
      )}
      {recurringExpenses.length > 0 && (
        <View className="mx-5 mt-3 mb-1 h-px bg-white/[0.06]" />
      )}

      {recurringExpenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=recurring")} />
      ) : isCurrentMonth ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) => (
            <ExpenseCard
              expense={item}
              index={index}
              referenceDate={(section as Section).referenceDate}
              onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-5 pt-5 pb-2 flex-row items-center gap-2">
              {section.accent === colors.overdue && (
                <Feather name="alert-triangle" size={12} color={colors.overdue} />
              )}
              <Text
                className="text-[11px] font-['Quicksand_700Bold'] uppercase tracking-widest"
                style={{ color: section.accent ?? "rgba(255,255,255,0.4)" }}
              >
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={flatList}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ExpenseCard
              expense={item}
              index={index}
              referenceDate={new Date(selectedYear, selectedMonth, 1)}
              onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
            />
          )}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Text className="text-white/30 text-sm font-['Quicksand_500Medium']">
                No recurring expenses for this month
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 3:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** Recurring screen shows month nav + recurring-only KPIs + sections; no greeting/settings; no one-offs; empty state opens `?type=recurring`. `KpiRow` default usage elsewhere still compiles.

---

### Task 5: Expenses (paid log) tab `[med]`

**Files:**
- Create: `app/(tabs)/expenses.tsx`

**Interfaces:**
- Consumes: `useExpenses()` (`expenses`, `loading`, `getMonthStatus`, `getMonthAmount`), `ExpenseCard`, `MonthNavigator`, `formatAmount` from `utils/dateHelpers`.
- Produces: default-export `ExpensesScreen`.

- [ ] **Step 1:** Create `app/(tabs)/expenses.tsx`:

```tsx
import React, { useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { format, startOfToday } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { MonthNavigator } from "../../components/MonthNavigator";
import { formatAmount } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

export default function ExpensesScreen() {
  const { expenses, loading, getMonthStatus, getMonthAmount } = useExpenses();
  const today = startOfToday();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { paidList, total } = useMemo(() => {
    const resolveAmount = (e: Expense): number =>
      e.isVariable ? (getMonthAmount(e.id, selectedYear, selectedMonth) ?? 0) : (e.amount ?? 0);

    const list = expenses
      .filter((e) => {
        if (e.recurrence === "one-off") {
          if (e.status !== "paid") return false;
          const c = new Date(e.createdAt);
          return c.getFullYear() === selectedYear && c.getMonth() === selectedMonth;
        }
        return getMonthStatus(e.id, selectedYear, selectedMonth) === "paid";
      })
      .sort((a, b) => a.dueDay - b.dueDay);

    const total = list.reduce((sum, e) => sum + resolveAmount(e), 0);
    return { paidList: list, total };
  }, [expenses, getMonthStatus, getMonthAmount, selectedYear, selectedMonth]);

  const monthLabel = format(new Date(selectedYear, selectedMonth, 1), "MMMM");

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.secondary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
      />

      <View className="flex-row items-baseline justify-between px-5 pt-2 pb-1">
        <Text
          className="text-[11px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Quicksand_700Bold" }}
        >
          Paid this month
        </Text>
        <Text className="text-[17px]" style={{ color: colors.paid, fontFamily: "Oswald_Medium" }}>
          {formatAmount(total)}
        </Text>
      </View>
      <View className="mx-5 mt-2 mb-1 h-px bg-white/[0.06]" />

      <FlatList
        data={paidList}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item}
            index={index}
            referenceDate={new Date(selectedYear, selectedMonth, 1)}
            onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
          />
        )}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-white/30 text-sm font-['Quicksand_500Medium']">
              No expenses paid in {monthLabel}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** Selecting a month lists paid recurring (that month) + paid one-offs (created that month), sorted by `dueDay`; total = sum of resolved amounts; toggling a card to unpaid drops it; empty → "No expenses paid in {Month}".

---

### Task 6: Home (slim dashboard) tab `[med]`

**Files:**
- Create: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useExpenses()` (`expenses`, `loading`, `userName`, `getMonthStatus`), `KpiRow`, `EmptyState`, `getGreeting`/`getFormattedDate`/`isOverdueOn`/`getDueDate` from `utils/dateHelpers`.
- Produces: default-export `HomeScreen`.

- [ ] **Step 1:** Create `app/(tabs)/index.tsx`:

```tsx
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { addDays, startOfToday } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate, getGreeting, getFormattedDate } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus } = useExpenses();
  const today = startOfToday();
  const year = today.getFullYear();
  const month = today.getMonth();

  const { overdueCount, dueSoonCount } = useMemo(() => {
    const in7 = addDays(today, 7);
    let overdueCount = 0;
    let dueSoonCount = 0;
    for (const e of expenses) {
      if (e.recurrence === "one-off") continue;
      if (getMonthStatus(e.id, year, month) !== "unpaid") continue;
      if (isOverdueOn(e.dueDay, year, month)) {
        overdueCount++;
      } else {
        const d = getDueDate(e.dueDay);
        if (d >= today && d <= in7) dueSoonCount++;
      }
    }
    return { overdueCount, dueSoonCount };
  }, [expenses, getMonthStatus, year, month]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.secondary} size="large" />
      </SafeAreaView>
    );
  }

  const hasAlerts = overdueCount > 0 || dueSoonCount > 0;
  const alertText = [
    overdueCount > 0 ? `${overdueCount} overdue` : null,
    dueSoonCount > 0 ? `${dueSoonCount} due in 7 days` : null,
  ].filter(Boolean).join(" · ");

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row justify-between items-start px-5 pt-2 pb-3">
        <View>
          <Text
            className="text-[11px] tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Quicksand_700Bold" }}
          >
            {getFormattedDate().toUpperCase()}
          </Text>
          <Text className="text-white text-[28px] tracking-wide" style={{ fontFamily: "Oswald_Medium" }}>
            {getGreeting(userName)}
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/[0.07] items-center justify-center mt-1"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Feather name="settings" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=regular")} />
      ) : (
        <View>
          <Text
            className="px-5 pt-2 pb-1 text-[11px] uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Quicksand_700Bold" }}
          >
            This Month
          </Text>
          <KpiRow year={year} month={month} />

          {hasAlerts ? (
            <TouchableOpacity
              onPress={() => router.push("/recurring")}
              activeOpacity={0.8}
              className="mx-5 mt-3 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-white/[0.07]"
            >
              <Feather
                name={overdueCount > 0 ? "alert-triangle" : "clock"}
                size={15}
                color={overdueCount > 0 ? colors.overdue : colors.secondary}
              />
              <Text className="flex-1 text-white/70 text-[13px] font-['Quicksand_500Medium']">
                {alertText}
              </Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ) : (
            <View className="mx-5 mt-3 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-white/[0.07]">
              <Feather name="check-circle" size={15} color={colors.paid} />
              <Text className="text-white/60 text-[13px] font-['Quicksand_500Medium']">
                All clear — nothing overdue or due soon
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** Header shows date + greeting + settings gear; KPIs = current-month totals across all expenses; alert card shows accurate overdue/due-soon counts and navigates to `/recurring`; empty → EmptyState opens `?type=regular`.

---

### Task 7: Tabs layout + remove old screen `[med]` (Wave 2 — after Tasks 3–6)

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Delete: `app/index.tsx`

**Interfaces:**
- Consumes: `FloatingTabBar` (Task 3); screen files `index`/`expenses`/`recurring` (Tasks 4–6).
- Produces: the `(tabs)` route group; `/` resolves to `app/(tabs)/index.tsx`.

- [ ] **Step 1:** Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { FloatingTabBar } from "../../components/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="expenses" options={{ title: "Expenses" }} />
      <Tabs.Screen name="recurring" options={{ title: "Recurring" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2:** Delete the old single screen (its logic now lives in `app/(tabs)/recurring.tsx`):

```bash
rm /Users/admin/Documents/personal/recur/app/index.tsx
```

- [ ] **Step 3:** Run `npx tsc --noEmit`. Expected: no new errors.

**Verify:** `app/index.tsx` is gone; only `app/(tabs)/index.tsx` serves `/`; `app/_layout.tsx` (root Stack) is unchanged and still wraps everything.

---

## Verification (end-to-end)

Run the app: `npm run android` (or `npm run ios`).

- [ ] App boots into the Home tab; floating bar shows 3 segments + inline `+`; active segment highlighted in `colors.secondary`.
- [ ] Tab switches preserve each tab's own month selection independently.
- [ ] FAB opens `/expense/add` with correct default recurrence: Home & Expenses → "One-off"; Recurring → "Monthly".
- [ ] Add a regular (one-off) expense → it saves as paid and appears immediately in the Expenses tab for the current month; it does NOT appear in Recurring.
- [ ] Add a recurring expense → unpaid; appears in Recurring; appears in Expenses only after marking it paid for a month.
- [ ] Recurring tab: no greeting/settings, no one-offs, KPIs recurring-only.
- [ ] Expenses tab: month picker filters paid items; toggling a card to unpaid removes it; total matches sum.
- [ ] Home: KPIs match current-month totals; overdue/due-soon counts accurate; tapping the alert card → Recurring tab.
- [ ] Modal routes (`expense/add`, `settings`) open full-screen, covering the tab bar.
- [ ] `npx tsc --noEmit` passes with no new errors.

## Self-Review (author)

- **Spec coverage:** Floating tab bar + context FAB (T3, T7) ✓; Recurring = current home minus greeting, recurring-only (T4) ✓; Expenses paid log w/ month picker (T5) ✓; Home slim dashboard (T6) ✓; type split via `recurrence` + `type` param (T2) ✓; auto-pay one-off (T1) ✓; modal routes preserved (T7 leaves root Stack untouched) ✓.
- **Placeholders:** none — full code in every code step.
- **Type consistency:** `recurringOnly?: boolean` defined in T4 and only consumed there; `type` param contract (`'regular'|'recurring'`) defined T2, used T3/T4/T6; `FloatingTabBar(props: BottomTabBarProps)` defined T3, consumed T7; all screens default-export the names referenced by the `(tabs)` group.
