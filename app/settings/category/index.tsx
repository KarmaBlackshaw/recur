import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, Alert, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "../../../components/ui/AppText";
import { Category, getAllWithIds, deleteCategory } from "../../../db/categories";
import { colors } from "../../../constants/theme";

export default function ManageCategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const cats = await getAllWithIds();
        if (active) setCategories(cats);
      }
      load();
      return () => { active = false; };
    }, [])
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
        <TouchableOpacity className="p-1" onPress={() => router.push("/settings/category/add")}>
          <Feather name="plus" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <AppText variant="body-medium" className="text-white/40 text-xs mb-2 px-1">
            Sorted by most recently used
          </AppText>
        }
        renderItem={({ item }) => (
          <View className="bg-surface border border-border rounded-xl px-3 py-3 mb-1 flex-row items-center gap-3">
            <TouchableOpacity className="p-1" onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={18} color={colors.overdue} />
            </TouchableOpacity>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">{item.name}</AppText>
            <TouchableOpacity className="p-1" onPress={() => router.push({ pathname: "/settings/category/add", params: { editId: String(item.id), editName: item.name } })}>
              <Feather name="edit-2" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
