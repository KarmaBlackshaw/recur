import React, { useRef, useState } from "react";
import { View, TextInput, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { FeatherIconName } from "../../../types";
import { AppText } from "../../../components/ui/AppText";
import { AppButton } from "../../../components/ui/AppButton";
import { getAll, insertCategory, renameCategory, updateIcon } from "../../../db/categories";
import { IconPickerBottomSheet, IconPickerBottomSheetRef } from "../../../components/IconPickerBottomSheet";
import { useExpenses } from "../../../context/ExpenseContext";
import { colors } from "../../../constants/theme";

export default function AddCategoryScreen() {
  const { editId, editName, editIcon } = useLocalSearchParams<{
    editId?: string;
    editName?: string;
    editIcon?: string;
  }>();
  const isEdit = !!editId;
  const [name, setName] = useState(editName ?? "");
  const [icon, setIcon] = useState<FeatherIconName>((editIcon ?? "more-horizontal") as FeatherIconName);
  const iconPickerRef = useRef<IconPickerBottomSheetRef>(null);
  const { reloadCategoryIcons } = useExpenses();

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEdit) {
      if (trimmed === editName && icon === editIcon) {
        router.back();
        return;
      }
      const existing = await getAll();
      if (trimmed !== editName && existing.includes(trimmed)) {
        Alert.alert("Already exists");
        return;
      }
      if (trimmed !== editName) await renameCategory(editId!, trimmed);
      if (icon !== editIcon) await updateIcon(editId!, icon);
      await reloadCategoryIcons();
      router.back();
      return;
    }
    const existing = await getAll();
    if (existing.includes(trimmed)) {
      Alert.alert("Already exists");
      return;
    }
    await insertCategory(trimmed, icon);
    await reloadCategoryIcons();
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

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "rgba(99,102,241,0.12)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
            }}
            onPress={() => iconPickerRef.current?.present()}
            accessibilityLabel="Pick icon"
          >
            <Feather name={icon} size={24} color={colors.secondary} />
          </TouchableOpacity>
          <AppText variant="body-medium" className="text-white/50 text-sm">
            Tap to choose icon
          </AppText>
        </View>

        <AppButton
          label={isEdit ? "Save Changes" : "Save Category"}
          onPress={handleSave}
          disabled={!name.trim()}
        />
      </View>

      <IconPickerBottomSheet
        ref={iconPickerRef}
        value={icon}
        onChange={setIcon}
      />
    </SafeAreaView>
  );
}
