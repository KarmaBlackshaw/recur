import React, { forwardRef, useCallback, useMemo, useRef } from "react";
import { TouchableOpacity } from "react-native";
import { AppSelectBottomSheet, AppSelectBottomSheetRef } from "@/components/ui/AppSelectBottomSheet";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";

export interface AccountPickerSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (accountId: string) => void;
  onDismiss?: () => void;
}

interface Option {
  id: string;
  name: string;
}

const NONE: Option = { id: "", name: "None" };

export const AccountPickerSheet = forwardRef<AccountPickerSheetRef, Props>(
  function AccountPickerSheet({ value, onChange, onDismiss }, ref) {
    const sheetRef = useRef<AppSelectBottomSheetRef>(null);
    const { accounts } = useAccounts();
    const options = useMemo<Option[]>(
      () => [NONE, ...accounts.map(({ id, name }) => ({ id, name }))],
      [accounts]
    );
    const selected = options.find((o) => o.id === value) ?? NONE;

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    const renderItem = useCallback(
      (item: Option, isSelected: boolean, onSelect: () => void) => (
        <TouchableOpacity
          className={`w-full py-6 px-2 items-center justify-center ${
            isSelected ? "bg-primary" : "bg-white/[0.04]"
          }`}
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          accessibilityState={{ selected: isSelected }}
        >
          <AppText
            variant={isSelected ? "body-bold" : "body-medium"}
            className={`text-base text-center ${isSelected ? "text-white" : "text-textSecondary"}`}
            numberOfLines={1}
          >
            {item.name}
          </AppText>
        </TouchableOpacity>
      ),
      []
    );

    return (
      <AppSelectBottomSheet
        ref={sheetRef}
        title="Pay from"
        items={options}
        value={selected}
        onChange={(item) => onChange(item.id)}
        onDismiss={onDismiss}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        columns={2}
      />
    );
  }
);
