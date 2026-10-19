import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, Alert, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { AppTabs } from "@/components/ui/AppTabs";
import { Category, getAllWithIds, deleteCategory } from "@/db/categories";
import { colors } from "@/constants/theme";
import type { CategoryKind } from "@/types";

const KIND_TABS: { label: string; value: CategoryKind }[] = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
];

export default function ManageCategoriesScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<CategoryKind>(params.kind === "income" ? "income" : "expense");
  const [categories, setCategories] = useState<Category[]>([]);

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

  function handleDelete(cat: Category) {
    Alert.alert("Delete category", `Remove "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCategory(cat.id);
          setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity className="p-1" onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Categories
        </AppText>
        <TouchableOpacity className="p-1" onPress={() => router.push({ pathname: "/settings/category/add", params: { kind } })}>
          <Feather name="plus" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <AppTabs tabs={KIND_TABS} value={kind} onChange={setKind} className="mb-3" />
            <AppText variant="body-medium" className="text-textMuted text-xs mb-2 px-1">
              Sorted by most recently used
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-surface border border-border rounded-xl px-3 py-3 mb-1 flex-row items-center gap-3">
            <TouchableOpacity className="p-1" onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={18} color={colors.overdue} />
            </TouchableOpacity>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">{item.name}</AppText>
            <TouchableOpacity className="p-1" onPress={() => router.push({ pathname: "/settings/category/add", params: { editId: String(item.id), editName: item.name, kind } })}>
              <Feather name="edit-2" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
