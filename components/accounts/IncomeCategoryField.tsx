import React, { useRef } from "react";
import { CategoryBottomSheet, type CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AppSelectField } from "@/components/ui/AppSelectField";

interface IncomeCategoryFieldProps {
  value: string;
  onChange: (category: string) => void;
}

export function IncomeCategoryField({ value, onChange }: IncomeCategoryFieldProps) {
  const sheetRef = useRef<CategoryBottomSheetRef>(null);
  return (
    <>
      <AppSelectField
        label="Category"
        value={value}
        onPress={() => sheetRef.current?.present()}
        accessibilityLabel={`Income category, ${value}`}
      />
      <CategoryBottomSheet ref={sheetRef} kind="income" value={value} onChange={onChange} />
    </>
  );
}
