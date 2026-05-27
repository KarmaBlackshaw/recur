# Category Bottom Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the category picker out of the add-expense scroll view into a `@gorhom/bottom-sheet` `BottomSheetModal`, replacing the inline grid with a tappable field that opens the sheet.

**Architecture:** Create a new `CategoryBottomSheet` component that owns the `BottomSheetModal` and renders a 3-column grid of category chips inside it. `add-expense.tsx` replaces the inline `<CategoryPicker>` with a tappable row that opens the sheet. The old `CategoryPicker` component is deleted (its DB/data logic moves into `CategoryBottomSheet`).

**Tech Stack:** React Native, NativeWind (StyleSheet fallback for Reanimated-incompatible styles), `@gorhom/bottom-sheet` (`BottomSheetModal`, `BottomSheetModalProvider` already in root layout), `react-hook-form` `Controller`, `expo/vector-icons` Ionicons, `date-fns` (not needed here), TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `components/CategoryBottomSheet.tsx` | Sheet modal + 3-col grid + custom category add |
| Modify | `app/add-expense.tsx` | Replace inline CategoryPicker with tappable row + sheet ref |
| Delete | `components/CategoryPicker.tsx` | Superseded by CategoryBottomSheet |

---

### Task 1: Create `CategoryBottomSheet` component

**Files:**
- Create: `components/CategoryBottomSheet.tsx`

This component receives the current `value`, an `onChange` callback, and exposes a `present()` method via `ref` so the parent can open it imperatively.

- [ ] **Step 1: Create the file with imports and types**

```tsx
// components/CategoryBottomSheet.tsx
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import BottomSheet, {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { PRESET_CATEGORIES } from "../utils/categories";
import { getCustom, insertCustom } from "../db/categories";
import { colors } from "../constants/theme";

export interface CategoryBottomSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (category: string) => void;
}
```

- [ ] **Step 2: Implement the component body**

```tsx
export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["60%", "85%"], []);

    const [custom, setCustom] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    const [newCat, setNewCat] = useState("");

    useEffect(() => {
      getCustom().then(setCustom);
    }, []);

    // Expose present() to parent via ref
    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    const allCategories = useMemo(
      () => [...PRESET_CATEGORIES, ...custom],
      [custom]
    );

    const handleSelect = useCallback(
      (cat: string) => {
        onChange(cat);
        sheetRef.current?.dismiss();
      },
      [onChange]
    );

    async function handleAddCustom() {
      const trimmed = newCat.trim();
      if (!trimmed) return;
      if (allCategories.includes(trimmed)) {
        Alert.alert("Already exists");
        return;
      }
      await insertCustom(trimmed);
      setCustom((prev) => [...prev, trimmed]);
      onChange(trimmed);
      setNewCat("");
      setAdding(false);
      sheetRef.current?.dismiss();
    }

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
        />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.container}>
          {/* Sheet header */}
          <Text style={styles.sheetTitle}>Category</Text>

          {/* 3-col grid */}
          <FlatList
            data={allCategories}
            keyExtractor={(item) => item}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cell, value === item && styles.cellSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text
                  style={[
                    styles.cellText,
                    value === item && styles.cellTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              adding ? (
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={newCat}
                    onChangeText={setNewCat}
                    placeholder="Category name"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    maxLength={30}
                    onSubmitEditing={handleAddCustom}
                  />
                  <TouchableOpacity onPress={handleAddCustom} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cell}
                  onPress={() => setAdding(true)}
                >
                  <Text style={styles.cellText}>+ Custom</Text>
                </TouchableOpacity>
              )
            }
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
```

- [ ] **Step 3: Add styles**

```tsx
const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface },
  handle: { backgroundColor: "rgba(255,255,255,0.2)", width: 40 },
  container: { flex: 1, paddingHorizontal: 16, paddingBottom: 32 },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: "Caveat_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  grid: { gap: 0 },
  cell: {
    flex: 1,
    margin: 4,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.secondary,
  },
  cellText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
    textAlign: "center",
  },
  cellTextSelected: {
    color: colors.text,
    fontFamily: "Quicksand_700Bold",
  },
  addRow: {
    flexDirection: "row",
    margin: 4,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontFamily: "Quicksand_400Regular",
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  addBtnText: {
    color: colors.text,
    fontFamily: "Quicksand_700Bold",
    fontSize: 13,
  },
});
```

---

### Task 2: Update `add-expense.tsx`

Replace the inline `<CategoryPicker>` block with:
1. A `useRef` to `CategoryBottomSheetRef`
2. A tappable row that shows the selected category and opens the sheet
3. The `<CategoryBottomSheet>` rendered at the bottom of the JSX (outside ScrollView)

**Files:**
- Modify: `app/add-expense.tsx`

- [ ] **Step 1: Swap import — remove CategoryPicker, add CategoryBottomSheet**

Remove:
```tsx
import { CategoryPicker } from "../components/CategoryPicker";
```
Add:
```tsx
import { CategoryBottomSheet, CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
```

- [ ] **Step 2: Add sheet ref inside `AddExpenseScreen`**

After `const { addExpense } = useExpenses();`, add:

```tsx
const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
```

Also add `useRef` to the React import if not already present — it's already there as part of `import React from "react"`, but `useRef` must be destructured from `react`. Change the existing React hooks import line to include `useRef`:

```tsx
import React, { useRef } from "react";
```

- [ ] **Step 3: Replace inline CategoryPicker JSX with tappable row**

Find and replace the category section (label + Controller with CategoryPicker):

```tsx
{/* Category */}
<Text style={styles.label}>Category</Text>
<Controller
  control={control}
  name="category"
  render={({ field: { value, onChange } }) => (
    <CategoryPicker value={value} onChange={onChange} />
  )}
/>
```

Replace with:

```tsx
{/* Category */}
<Text style={styles.label}>Category</Text>
<Controller
  control={control}
  name="category"
  render={({ field: { value } }) => (
    <TouchableOpacity
      style={styles.categoryRow}
      onPress={() => categorySheetRef.current?.present()}
    >
      <Text style={styles.categoryValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
    </TouchableOpacity>
  )}
/>
```

- [ ] **Step 4: Render `<CategoryBottomSheet>` outside ScrollView**

The `SafeAreaView` currently wraps a header `View` and a `ScrollView`. After the closing `</ScrollView>` tag but still inside `</SafeAreaView>`, add:

```tsx
<Controller
  control={control}
  name="category"
  render={({ field: { value, onChange } }) => (
    <CategoryBottomSheet
      ref={categorySheetRef}
      value={value}
      onChange={onChange}
    />
  )}
/>
```

- [ ] **Step 5: Add new styles to `StyleSheet.create`**

Inside the existing `styles` object, add:

```tsx
categoryRow: {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
},
categoryValue: {
  color: "#FFFFFF",
  fontFamily: "Quicksand_500Medium",
  fontSize: 15,
},
```

---

### Task 3: Delete `CategoryPicker.tsx`

**Files:**
- Delete: `components/CategoryPicker.tsx`

- [ ] **Step 1: Verify no other file imports CategoryPicker**

Run:
```bash
grep -r "CategoryPicker" . --include="*.tsx" --include="*.ts" -l
```
Expected output: only `components/CategoryPicker.tsx` itself (or nothing). If another file imports it, update that file first.

- [ ] **Step 2: Delete the file**

```bash
rm components/CategoryPicker.tsx
```

---

## Verification

- [ ] `npx expo start` — no TypeScript / Metro errors on startup
- [ ] Tap **Category** row on Add Expense screen → bottom sheet rises with 3-col grid
- [ ] Tap a category → sheet dismisses, row updates to show selected category name
- [ ] Tap **+ Custom**, type a name, tap Add → sheet dismisses, row shows new category
- [ ] Duplicate custom category → Alert "Already exists" fires
- [ ] Submit form → expense saved with correct category
- [ ] Back button / swipe-to-dismiss sheet works without crashing
