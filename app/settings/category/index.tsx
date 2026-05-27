import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../components/ui/AppText";
import { DraggableList } from "../../../components/ui/DraggableList";
import { Category, getAllWithIds, deleteCategory, updateOrder } from "../../../db/categories";
import { colors } from "../../../constants/theme";
import { useExpenses } from "../../../context/ExpenseContext";

export default function ManageCategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { reloadCategoryIcons } = useExpenses();

  useFocusEffect(
    useCallback(() => {
      getAllWithIds().then(setCategories);
      reloadCategoryIcons();
    }, [reloadCategoryIcons])
  );

  function handleDelete(cat: Category) {
    Alert.alert("Delete category", `Remove "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCategory(cat.id);
          setCategories((prev) => {
            const next = prev.filter((c) => c.id !== cat.id);
            updateOrder(next.map((c) => c.id));
            return next;
          });
        },
      },
    ]);
  }

  function handleReorder(reordered: Category[]) {
    setCategories(reordered);
    updateOrder(reordered.map((c) => c.id));
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
        <TouchableOpacity className="p-1" onPress={() => router.push("/settings/category/add")}>
          <Feather name="plus" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <DraggableList
        data={categories}
        keyExtractor={(item) => item.id}
        itemHeight={52}
        onReorder={handleReorder}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={(item) => (
          <View className="bg-surface border border-border rounded-xl px-3 py-3 mb-1 flex-row items-center gap-3">
            <TouchableOpacity className="p-1" onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={18} color={colors.overdue} />
            </TouchableOpacity>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "rgba(99,102,241,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name={(item.icon ?? "more-horizontal") as keyof typeof Feather.glyphMap} size={16} color={colors.secondary} />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">{item.name}</AppText>
            <TouchableOpacity className="p-1" onPress={() => router.push({ pathname: "/settings/category/add", params: { editId: item.id, editName: item.name, editIcon: item.icon } })}>
              <Feather name="edit-2" size={16} color={colors.secondary} />
            </TouchableOpacity>
            <Ionicons name="reorder-two-outline" size={20} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
