// components/CategoryBottomSheet.tsx
import React, { forwardRef, useRef } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppSelectBottomSheet, AppSelectBottomSheetRef } from "./ui/AppSelectBottomSheet";
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

    const action = (
      <TouchableOpacity
        className="p-1"
        onPress={() => {
          sheetRef.current?.dismiss();
          router.push("/manage-categories");
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
        action={action}
      />
    );
  }
);
