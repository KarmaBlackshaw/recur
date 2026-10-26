import React, { useState } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useMount } from "@/utils/useMount";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { getAll, insertCategory, renameCategory } from "@/db/categories";
import { colors } from "@/constants/theme";

interface FormValues {
  name: string;
}

export default function AddCategoryScreen() {
  const { editId, editName, kind: kindParam } = useLocalSearchParams<{
    editId?: string;
    editName?: string;
    kind?: string;
  }>();
  const kind = kindParam === "income" ? "income" : "expense";
  const isEdit = !!editId;
  const originalName = editName ?? "";
  const { reloadAll } = useExpenses();
  const { reload } = useAccounts();
  // Leaves out the category being renamed, so a case-only rename ("food" to "Food") is allowed.
  const [otherNames, setOtherNames] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<FormValues>({ mode: "onChange", defaultValues: { name: originalName } });

  useMount(async () => {
    const names = await getAll(kind);
    setOtherNames(isEdit ? names.filter((n) => n !== originalName) : names);
  });

  function validateName(value: string): true | string {
    const trimmed = value.trim();
    if (!trimmed) {
      return "Enter a name";
    }
    if (isEdit && trimmed === originalName) {
      return true;
    }
    const lower = trimmed.toLowerCase();
    const clash = otherNames.find((n) => n.toLowerCase() === lower);
    return clash ? `"${clash}" already exists` : true;
  }

  const onSubmit = handleSubmit(async ({ name }) => {
    const trimmed = name.trim();
    if (isEdit && trimmed === originalName) {
      router.back();
      return;
    }
    try {
      if (isEdit) {
        await renameCategory(Number(editId), trimmed);
        await Promise.all([reloadAll(), reload()]);
      } else {
        await insertCategory(trimmed, kind);
      }
      router.back();
    } catch (e) {
      console.error("Save category failed", e);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  });

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
          {isEdit ? "Edit Category" : "Add Category"}
        </AppText>
        <View className="w-11" />
      </View>

      <View className="px-4 pt-4 gap-3">
        <Controller
          control={control}
          name="name"
          rules={{ validate: validateName }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Name"
              error={fieldState.error?.message}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Category name…"
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <AppButton
          label={isEdit ? "Save Changes" : "Save Category"}
          onPress={onSubmit}
          disabled={!isValid}
          loading={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}
