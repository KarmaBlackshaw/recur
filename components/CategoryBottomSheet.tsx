// components/CategoryBottomSheet.tsx
import React, { forwardRef, useRef } from "react";
import { Alert, Keyboard, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";
import { getAll, insertCategory } from "@/db/categories";
import type { CategoryKind } from "@/types";

export interface CategoryBottomSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (category: string) => void;
  onDismiss?: () => void;
  kind?: CategoryKind;
}

// No fixed snap points: the sheet sizes to its form.
const CONTENT_HEIGHT_SNAP: string[] = [];

interface NewCategorySheetProps {
  kind: CategoryKind;
  existingNames: string[];
  onAdded: (name: string) => void;
}

interface NewCategoryFormValues {
  name: string;
}

// Adds a category without leaving the form that asked for one.
const NewCategorySheet = forwardRef<AppBottomSheetRef, NewCategorySheetProps>(function NewCategorySheet(
  { kind, existingNames, onAdded },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting },
  } = useForm<NewCategoryFormValues>({ mode: "onChange", defaultValues: { name: "" } });

  React.useImperativeHandle(ref, () => ({
    present: () => {
      reset({ name: "" });
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  function validateUnique(value: string): true | string {
    const lower = value.trim().toLowerCase();
    const clash = existingNames.find((name) => name.toLowerCase() === lower);
    return clash ? `"${clash}" already exists` : true;
  }

  const onSubmit = handleSubmit(async ({ name }) => {
    const trimmed = name.trim();
    try {
      await insertCategory(trimmed, kind);
    } catch (error) {
      console.error("Add category failed", error);
      Alert.alert("Couldn't add category", "Something went wrong. Please try again.");
      return;
    }
    Keyboard.dismiss();
    onAdded(trimmed);
  });

  return (
    <AppBottomSheet
      ref={sheetRef}
      title="New category"
      snapPoints={CONTENT_HEIGHT_SNAP}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View className="px-4 pb-4">
        <Controller
          control={control}
          name="name"
          rules={{
            validate: {
              filled: (v) => v.trim() !== "" || "Enter a name",
              unique: validateUnique,
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={kind === "income" ? "e.g. Rental" : "e.g. Pets"}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              // A taken name shows while typing so a disabled Add explains itself; an empty one waits for a blur.
              error={
                fieldState.isTouched || fieldState.error?.type === "unique" ? fieldState.error?.message : undefined
              }
            />
          )}
        />
        <AppButton
          label="Add category"
          onPress={onSubmit}
          disabled={!isValid}
          loading={isSubmitting}
          className="mt-3"
        />
      </View>
    </AppBottomSheet>
  );
});

export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange, onDismiss, kind = "expense" }, ref) {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const newCategorySheetRef = useRef<AppBottomSheetRef>(null);
    const [categories, setCategories] = React.useState<string[]>([]);
    const options = categories.map((category) => ({ label: category, value: category }));

    React.useImperativeHandle(ref, () => ({
      present: async () => {
        const cats = await getAll(kind);
        setCategories(cats);
        sheetRef.current?.present();
      },
    }));

    function handleChange(category: string) {
      onChange(category);
      sheetRef.current?.dismiss();
    }

    function handleAdded(name: string) {
      // New categories have never been used, so they sort last.
      setCategories((prev) => [...prev, name]);
      onChange(name);
      // This sheet waits minimized under the new-category one; dismissing it first keeps it from coming back up.
      sheetRef.current?.dismiss();
      newCategorySheetRef.current?.dismiss();
    }

    const action = (
      <TouchableOpacity
        className="w-11 h-11 items-center justify-center"
        onPress={() => {
          sheetRef.current?.dismiss();
          router.push(`/settings/category?kind=${kind}`);
        }}
        accessibilityRole="button"
        accessibilityLabel="Manage categories"
      >
        <Feather name="edit-2" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );

    return (
      <>
        <AppBottomSheet ref={sheetRef} title="Category" action={action} onDismiss={onDismiss}>
          <BottomSheetScrollView contentContainerClassName="px-4 pb-[200px]">
            <AppRadioGroup options={options} value={value} onChange={handleChange} />
            <TouchableOpacity
              className="flex-row items-center self-start gap-2 min-h-[44px] px-6 mt-1 rounded-2xl border border-secondary/40"
              onPress={() => newCategorySheetRef.current?.present()}
              accessibilityRole="button"
              accessibilityLabel="New category"
            >
              <Feather name="plus" size={16} color={colors.secondary} />
              <AppText variant="body-bold" className="text-sm text-secondary">
                New category
              </AppText>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </AppBottomSheet>
        <NewCategorySheet ref={newCategorySheetRef} kind={kind} existingNames={categories} onAdded={handleAdded} />
      </>
    );
  }
);
