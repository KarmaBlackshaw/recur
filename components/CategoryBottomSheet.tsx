// components/CategoryBottomSheet.tsx
import React, { forwardRef, useCallback, useRef } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppSelectBottomSheet, AppSelectBottomSheetRef } from "@/components/ui/AppSelectBottomSheet";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { getAll } from "@/db/categories";

export interface CategoryBottomSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (category: string) => void;
  onDismiss?: () => void;
}

export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange, onDismiss }, ref) {
    const sheetRef = useRef<AppSelectBottomSheetRef>(null);
    const [categories, setCategories] = React.useState<string[]>([]);

    React.useImperativeHandle(ref, () => ({
      present: async () => {
        const cats = await getAll();
        setCategories(cats);
        sheetRef.current?.present();
      },
    }));

    const renderItem = useCallback(
      (item: string, selected: boolean, onSelect: () => void) => (
        <TouchableOpacity
          key={item}
          className={`w-full py-6 px-2 items-center justify-center ${
            selected ? "bg-primary" : "bg-white/[0.04]"
          }`}
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={item}
          accessibilityState={{ selected }}
        >
          <AppText
            variant={selected ? "body-bold" : "body-medium"}
            className={`text-base text-center ${selected ? "text-white" : "text-textSecondary"}`}
            numberOfLines={1}
          >
            {item}
          </AppText>
        </TouchableOpacity>
      ),
      []
    );

    const action = (
      <TouchableOpacity
        className="w-11 h-11 items-center justify-center"
        onPress={() => {
          sheetRef.current?.dismiss();
          router.push("/settings/category");
        }}
        accessibilityRole="button"
        accessibilityLabel="Manage categories"
      >
        <Feather name="edit-2" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );

    return (
      <AppSelectBottomSheet
        ref={sheetRef}
        title="Category"
        items={categories}
        value={value}
        onChange={onChange}
        onDismiss={onDismiss}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        action={action}
      />
    );
  }
);
