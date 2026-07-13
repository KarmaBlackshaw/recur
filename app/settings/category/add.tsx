import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "../../../components/ui/AppText";
import { AppButton } from "../../../components/ui/AppButton";
import { getAll, insertCategory, renameCategory } from "../../../db/categories";
import { colors } from "../../../constants/theme";

export default function AddCategoryScreen() {
  const { editId, editName } = useLocalSearchParams<{
    editId?: string;
    editName?: string;
  }>();
  const isEdit = !!editId;
  const [name, setName] = useState(editName ?? "");

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEdit) {
      if (trimmed === editName) {
        router.back();
        return;
      }
      const existing = await getAll();
      if (existing.includes(trimmed)) {
        Alert.alert("Already exists");
        return;
      }
      await renameCategory(Number(editId), trimmed);
      router.back();
      return;
    }
    const existing = await getAll();
    if (existing.includes(trimmed)) {
      Alert.alert("Already exists");
      return;
    }
    await insertCategory(trimmed);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity className="p-1" onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          {isEdit ? "Edit Category" : "Add Category"}
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <View className="px-4 pt-4 gap-3">
        <TextInput
          className="bg-surface border border-border rounded-xl px-4 py-3 text-white text-base font-quicksand"
          value={name}
          onChangeText={setName}
          placeholder="Category name…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoFocus
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <AppButton
          label={isEdit ? "Save Changes" : "Save Category"}
          onPress={handleSave}
          disabled={!name.trim()}
        />
      </View>
    </SafeAreaView>
  );
}
