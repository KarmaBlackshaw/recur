import React, { forwardRef, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AccountCard } from "@/components/accounts/AccountCard";
import { useAccounts } from "@/context/AccountContext";
import type { Account } from "@/types";

export interface AccountPickerSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (accountId: string) => void;
  onDismiss?: () => void;
  title?: string;
  options?: Account[];
}

export const AccountPickerSheet = forwardRef<AccountPickerSheetRef, Props>(
  function AccountPickerSheet({ value, onChange, onDismiss, title = "Pay from", options }, ref) {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const { activeAccounts } = useAccounts();
    const pickable = options ?? activeAccounts;
    const { fontScale } = useWindowDimensions();
    const cardWidth = fontScale > 1.3 ? "100%" : "50%";

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    function handleSelect(accountId: string) {
      onChange(accountId);
      sheetRef.current?.dismiss();
    }

    return (
      <AppBottomSheet ref={sheetRef} title={title} onDismiss={onDismiss}>
        <BottomSheetScrollView contentContainerClassName="flex-row flex-wrap px-4 pb-[200px]">
          {pickable.map((account) => (
            <View
              key={account.id}
              className="p-1.5"
              style={{ width: cardWidth }}
              accessibilityState={{ selected: account.id === value }}
            >
              <AccountCard account={account} onPress={() => handleSelect(account.id)} isCompact />
            </View>
          ))}
        </BottomSheetScrollView>
      </AppBottomSheet>
    );
  }
);
