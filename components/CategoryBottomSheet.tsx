// components/CategoryBottomSheet.tsx
import React, { forwardRef, useCallback, useRef } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppSelectBottomSheet, AppSelectBottomSheetRef } from "./ui/AppSelectBottomSheet";
import { AppText } from "./ui/AppText";
import { getAll } from "../db/categories";
import { colors } from "../constants/theme";

export interface CategoryBottomSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (category: string) => void;
}

export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange }, ref) {
    const sheetRef = useRef<AppSelectBottomSheetRef>(null);
    const [categories, setCategories] = React.useState<string[]>([]);

    React.useImperativeHandle(ref, () => ({
      present: () => {
        getAll().then(setCategories);
        sheetRef.current?.present();
      },
    }));

    const renderItem = useCallback(
      (item: string, selected: boolean, onSelect: () => void) => (
        <TouchableOpacity
          key={item}
          className={`flex-1 m-1 py-3.5 px-1 rounded-xl border items-center justify-center ${
            selected ? "bg-primary border-secondary" : "bg-background border-white/10"
          }`}
          onPress={onSelect}
        >
          <AppText
            variant={selected ? "body-bold" : "body-medium"}
            className={`text-xs text-center ${selected ? "text-white" : "text-white/70"}`}
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
        className="p-1"
        onPress={() => {
          sheetRef.current?.dismiss();
          router.push("/settings/category");
        }}
      >
        <Feather name="edit-2" size={18} color={colors.secondary} />
      </TouchableOpacity>
    );

    return (
      <AppSelectBottomSheet
        ref={sheetRef}
        title="Category"
        items={categories}
        value={value}
        onChange={onChange}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        action={action}
      />
    );
  }
);
