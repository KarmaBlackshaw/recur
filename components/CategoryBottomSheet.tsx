// components/CategoryBottomSheet.tsx
import React, { forwardRef, useRef } from "react";
import { TouchableOpacity } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { colors } from "@/constants/theme";
import { getAll } from "@/db/categories";
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

export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange, onDismiss, kind = "expense" }, ref) {
    const sheetRef = useRef<AppBottomSheetRef>(null);
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
      <AppBottomSheet ref={sheetRef} title="Category" action={action} onDismiss={onDismiss}>
        <BottomSheetScrollView contentContainerClassName="px-4 pb-[200px]">
          <AppRadioGroup options={options} value={value} onChange={handleChange} />
        </BottomSheetScrollView>
      </AppBottomSheet>
    );
  }
);
