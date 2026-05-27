import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { AppText } from "../components/ui/AppText";
import { getAll, deleteCategory } from "../db/categories";
import { colors } from "../constants/theme";

export default function ManageCategoriesScreen() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    getAll().then(setCategories);
  }, []);

  function handleDelete(name: string) {
    Alert.alert("Delete category", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCategory(name);
          setCategories((prev) => prev.filter((c) => c !== name));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
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

      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View className="bg-surface border border-border rounded-xl px-3 py-3 mb-1 flex-row items-center gap-3">
            <TouchableOpacity className="p-1" onPress={() => handleDelete(item)}>
              <Feather name="trash-2" size={18} color={colors.overdue} />
            </TouchableOpacity>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">{item}</AppText>
            <TouchableOpacity className="p-1">
              <Feather name="edit-2" size={16} color={colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity className="p-1">
              <Ionicons name="reorder-two-outline" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
