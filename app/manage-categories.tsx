import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppText } from "../components/ui/AppText";
import { DraggableList } from "../components/ui/DraggableList";
import { getAll, deleteCategory, updateOrder } from "../db/categories";
import { colors } from "../constants/theme";

export default function ManageCategoriesScreen() {
  const [categories, setCategories] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAll().then(setCategories);
    }, [])
  );

  function handleDelete(name: string) {
    Alert.alert("Delete category", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCategory(name);
          setCategories((prev) => {
            const next = prev.filter((c) => c !== name);
            updateOrder(next);
            return next;
          });
        },
      },
    ]);
  }

  function handleReorder(reordered: string[]) {
    setCategories(reordered);
    updateOrder(reordered);
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
        <TouchableOpacity className="p-1" onPress={() => router.push("/add-category")}>
          <Feather name="plus" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <DraggableList
        data={categories}
        keyExtractor={(item) => item}
        itemHeight={52}
        onReorder={handleReorder}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={(item) => (
          <View className="bg-surface border border-border rounded-xl px-3 py-3 mb-1 flex-row items-center gap-3">
            <TouchableOpacity className="p-1" onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={18} color={colors.overdue} />
            </TouchableOpacity>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">{item}</AppText>
            <TouchableOpacity className="p-1" onPress={() => router.push({ pathname: "/add-category", params: { edit: item } })}>
              <Feather name="edit-2" size={16} color={colors.secondary} />
            </TouchableOpacity>
            <Ionicons name="reorder-two-outline" size={20} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
