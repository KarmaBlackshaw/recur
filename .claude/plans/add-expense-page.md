# Add Expense Page Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AddExpenseModal` bottom sheet with a dedicated Expo Router screen at `app/add-expense.tsx`, navigated to via `router.push('/add-expense')`.

**Architecture:** The form logic and UI from `AddExpenseModal` moves verbatim into a new full-screen page. `app/index.tsx` swaps the `BottomSheetModal` ref + `<AddExpenseModal>` render for a simple `router.push('/add-expense')` call. `BottomSheetModalProvider` can be removed from `_layout.tsx` if no other sheets remain. The old `components/AddExpenseModal.tsx` is deleted; `ExpenseFormValues` is moved to `types.ts` so it stays accessible.

**Tech Stack:** Expo Router v3, React Hook Form, NativeWind v4, expo-sqlite via `ExpenseContext`, `react-native-safe-area-context`, `@expo/vector-icons`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `types.ts` | Add `ExpenseFormValues` export |
| Create | `app/add-expense.tsx` | Full-screen Add Expense form (owns all form logic) |
| Modify | `app/index.tsx` | Remove BottomSheetModal ref + AddExpenseModal render; FAB calls `router.push('/add-expense')` |
| Modify | `app/_layout.tsx` | Remove `BottomSheetModalProvider` (no other sheets) |
| Delete | `components/AddExpenseModal.tsx` | No longer needed |

---

## Task 1: Add `ExpenseFormValues` to `types.ts`

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add the type**

Open `types.ts` and append:

```ts
export interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  notes: string;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors (or same errors as before this change).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: export ExpenseFormValues from types.ts"
```

---

## Task 2: Create `app/add-expense.tsx`

**Files:**
- Create: `app/add-expense.tsx`
- Reference (no change): `components/CategoryPicker.tsx`, `context/ExpenseContext.tsx`, `constants/theme.ts`, `types.ts`

- [ ] **Step 1: Create the file**

```tsx
import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import { useExpenses } from "../context/ExpenseContext";
import { CategoryPicker } from "../components/CategoryPicker";
import { colors } from "../constants/theme";
import type { Recurrence, ExpenseFormValues } from "../types";

const RECURRENCE_OPTIONS: { label: string; value: Recurrence }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
  { label: "One-off", value: "one-off" },
];

export default function AddExpenseScreen() {
  const { addExpense } = useExpenses();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      amount: "",
      category: "Other",
      dueDay: "1",
      recurrence: "monthly",
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum < 0.01) {
      Alert.alert("Invalid amount");
      return;
    }
    await addExpense({
      name: data.name.trim(),
      amount: amountNum,
      category: data.category,
      dueDay: parseInt(data.dueDay, 10),
      recurrence: data.recurrence,
      status: "unpaid",
      notes: data.notes.trim() || undefined,
    });
    reset();
    router.back();
  });

  function handleCancel() {
    reset();
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: true, minLength: 1 }}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Netflix"
              placeholderTextColor="rgba(255,255,255,0.3)"
              returnKeyType="next"
            />
          )}
        />

        {/* Amount */}
        <Text style={styles.label}>Amount *</Text>
        <Controller
          control={control}
          name="amount"
          rules={{ required: true }}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
          )}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <CategoryPicker value={value} onChange={onChange} />
          )}
        />

        {/* Due Day */}
        <Text style={[styles.label, { marginTop: 12 }]}>Due Day (1–31) *</Text>
        <Controller
          control={control}
          name="dueDay"
          rules={{
            required: true,
            validate: (v) => {
              const n = parseInt(v, 10);
              return (!isNaN(n) && n >= 1 && n <= 31) || "Must be 1–31";
            },
          }}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              returnKeyType="next"
              maxLength={2}
            />
          )}
        />

        {/* Recurrence */}
        <Text style={styles.label}>Recurrence</Text>
        <Controller
          control={control}
          name="recurrence"
          render={({ field: { value, onChange } }) => (
            <View style={styles.segmented}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segment,
                    value === opt.value && styles.segmentActive,
                  ]}
                  onPress={() => onChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      value === opt.value && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional note…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
          )}
        />

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
          onPress={onSubmit}
          disabled={!isValid}
        >
          <Text style={styles.saveBtnText}>Save Expense</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Caveat_700Bold",
  },
  headerSpacer: { width: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontFamily: "Quicksand_400Regular",
    fontSize: 15,
    marginBottom: 4,
  },
  amountRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  currencyPrefix: {
    color: colors.secondary,
    fontSize: 18,
    fontFamily: "Caveat_700Bold",
    marginRight: 8,
  },
  amountInput: { flex: 1, marginBottom: 0 },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
    overflow: "hidden",
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
  },
  segmentTextActive: { color: "#FFFFFF", fontFamily: "Quicksand_700Bold" },
  notesInput: { height: 72, marginBottom: 4 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Quicksand_700Bold",
    letterSpacing: 0.5,
  },
});
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/add-expense.tsx
git commit -m "feat: add full-screen AddExpense page"
```

---

## Task 3: Update `app/index.tsx`

**Files:**
- Modify: `app/index.tsx`

Remove everything related to `BottomSheetModal`, `AddExpenseModal`, and the `modalRef`. Replace with `router.push`.

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addDays, startOfDay } from "date-fns";
import { useExpenses } from "../context/ExpenseContext";
import { ExpenseCard } from "../components/ExpenseCard";
import { KpiRow } from "../components/KpiRow";
import { EmptyState } from "../components/EmptyState";
import { isOverdue, getDueDate } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
}

export default function HomeScreen() {
  const { expenses, loading } = useExpenses();

  const sections: Section[] = useMemo(() => {
    const today = startOfDay(new Date());
    const in30 = addDays(today, 30);

    const overdue = expenses.filter(
      (e) => e.status === "unpaid" && isOverdue(e.dueDay)
    );
    const upcoming = expenses.filter((e) => {
      const d = getDueDate(e.dueDay);
      return d >= today && d <= in30 && !isOverdue(e.dueDay);
    });

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "⚠ Overdue", data: overdue, accent: colors.overdue });
    }
    if (upcoming.length > 0) {
      result.push({ title: "Upcoming — Next 30 Days", data: upcoming, accent: colors.secondary });
    }
    result.push({ title: "All Expenses", data: expenses });
    return result;
  }, [expenses]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={colors.secondary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Recur</Text>
      </View>

      {/* KPI row */}
      {expenses.length > 0 && <KpiRow expenses={expenses} />}

      {/* Expense sections */}
      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/add-expense")} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <ExpenseCard expense={item} index={index} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, section.accent ? { color: section.accent } : {}]}>
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/add-expense")}
        accessibilityLabel="Add expense"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: "Caveat_700Bold",
    letterSpacing: 1,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  listContent: {
    paddingBottom: 40,
  },
});
```

> **Note on `isOverdue` / `getDueDate`:** The existing `index.tsx` used `parseISO(e.dueDate)` but the data model was already migrated to `dueDay: number`. This step aligns the screen with the current model. Verify `utils/dateHelpers.ts` exports both `isOverdue(dueDay: number)` and `getDueDate(dueDay: number)` — they should already exist per recent commits.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "refactor: replace BottomSheet modal with router.push to add-expense"
```

---

## Task 4: Remove `BottomSheetModalProvider` from `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Remove `BottomSheetModalProvider`**

In `app/_layout.tsx`, delete the `BottomSheetModalProvider` import and its JSX wrapper. Result:

```tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Caveat_400Regular,
  Caveat_700Bold,
} from "@expo-google-fonts/caveat";
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
import { ExpenseProvider } from "../context/ExpenseContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Caveat_400Regular,
    Caveat_700Bold,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ExpenseProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0F172A" },
            }}
          />
        </ExpenseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "refactor: remove BottomSheetModalProvider from root layout"
```

---

## Task 5: Delete `components/AddExpenseModal.tsx`

**Files:**
- Delete: `components/AddExpenseModal.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "AddExpenseModal" .
```

Expected: zero results (all refs removed in Task 3).

- [ ] **Step 2: Delete the file**

```bash
rm components/AddExpenseModal.tsx
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete AddExpenseModal component (replaced by add-expense page)"
```

---

## Verification

- [ ] `npx expo start` — app launches without error
- [ ] FAB on home screen navigates to `/add-expense` (full-screen push transition)
- [ ] "Add expense" on `EmptyState` navigates to `/add-expense`
- [ ] Form validation: Save button disabled until Name + Amount + valid Due Day filled
- [ ] Back button (chevron) and `router.back()` after save return to home
- [ ] Newly saved expense appears in the home list immediately
- [ ] No references to `BottomSheetModal` or `AddExpenseModal` remain in codebase
- [ ] `npx tsc --noEmit` passes clean
