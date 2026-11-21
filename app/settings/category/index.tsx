import React, { useState, useCallback, useRef } from "react";
import { View, TouchableOpacity, Alert, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppTabs } from "@/components/ui/AppTabs";
import { MoveCategorySheet, type MoveCategorySheetRef } from "@/components/MoveCategorySheet";
import { Category, getAllWithIds, deleteCategory, countCategoryUses } from "@/db/categories";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { colors } from "@/constants/theme";
import { isLockedCategory } from "@/utils/categories";
import { categoryUsesLabel } from "@/utils/categoryUsesLabel";
import type { CategoryKind, TOption } from "@/types";

const KIND_TABS: TOption<CategoryKind>[] = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
];

export default function ManageCategoriesScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<CategoryKind>(params.kind === "income" ? "income" : "expense");
  const [categories, setCategories] = useState<Category[]>([]);
  const moveSheetRef = useRef<MoveCategorySheetRef>(null);
  const { reloadAll } = useExpenses();
  const { reload } = useAccounts();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const cats = await getAllWithIds(kind);
        if (active) {
          setCategories(cats);
        }
      }
      load();
      return () => { active = false; };
    }, [kind])
  );

  async function removeCategory(cat: Category, moveTo?: string) {
    try {
      await deleteCategory(cat.id, moveTo);
      if (moveTo) {
        await Promise.all([reloadAll(), reload()]);
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (e) {
      console.error("Delete category failed", e);
      Alert.alert("Delete failed", "Something went wrong. Please try again.");
    }
  }

  async function handleDelete(cat: Category) {
    const uses = await countCategoryUses(cat.id);
    if (uses === 0) {
      Alert.alert("Delete category", `Remove "${cat.name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => removeCategory(cat) },
      ]);
      return;
    }
    const options = categories
      .filter((c) => c.id !== cat.id && !isLockedCategory(c.name, kind))
      .map((c) => c.name);
    if (options.length === 0) {
      Alert.alert(
        `Can't delete ${cat.name}`,
        uses === 1
          ? `${categoryUsesLabel(kind, uses)} uses it. Add another category to move it to first.`
          : `${categoryUsesLabel(kind, uses)} use it. Add another category to move them to first.`
      );
      return;
    }
    const moveTo = await moveSheetRef.current?.ask({ name: cat.name, kind, uses, options });
    if (moveTo) {
      await removeCategory(cat, moveTo);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity
          className="w-11 h-11 items-center justify-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Categories
        </AppText>
        <TouchableOpacity
          className="w-11 h-11 items-center justify-center"
          onPress={() => router.push({ pathname: "/settings/category/add", params: { kind } })}
          accessibilityRole="button"
          accessibilityLabel="Add category"
        >
          <Feather name="plus" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="px-4 pb-8"
        ListHeaderComponent={
          <View>
            <AppTabs tabs={KIND_TABS} value={kind} onChange={setKind} className="mb-3" />
            <AppText variant="body-medium" className="text-textMuted text-xs mb-2 px-1">
              Sorted by most recently used
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const locked = isLockedCategory(item.name, kind);
          return (
            <View className="bg-surface border border-border rounded-xl px-1 py-1 mb-1 flex-row items-center gap-1">
              {locked ? (
                <View className="w-11 h-11 items-center justify-center">
                  <Feather name="lock" size={16} color={colors.textMuted} />
                </View>
              ) : (
                <TouchableOpacity
                  className="w-11 h-11 items-center justify-center"
                  onPress={() => handleDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <Feather name="trash-2" size={18} color={colors.overdue} />
                </TouchableOpacity>
              )}
              <AppText variant="body-medium" className="flex-1 text-white text-sm">{item.name}</AppText>
              {!locked && (
                <TouchableOpacity
                  className="w-11 h-11 items-center justify-center"
                  onPress={() => router.push({ pathname: "/settings/category/add", params: { editId: String(item.id), editName: item.name, kind } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${item.name}`}
                >
                  <Feather name="edit-2" size={16} color={colors.secondary} />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
      <MoveCategorySheet ref={moveSheetRef} />
    </SafeAreaView>
  );
}
