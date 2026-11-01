import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Alert, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/context/AccountContext";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { formatAmount } from "@/utils/formatAmount";
import type { Account } from "@/types";

export interface AdjustBalanceSheetRef {
  present: () => void;
}

export const AdjustBalanceSheet = forwardRef<AdjustBalanceSheetRef, { account: Account }>(
  function AdjustBalanceSheet({ account }, ref) {
    const sheetRef = useRef<AppBottomSheetRef>(null);
    const accounts = useAccounts();
    const balance = accounts.getBalance(account.id);
    const {
      control,
      handleSubmit,
      reset,
      formState: { isValid },
    } = useForm<{ target: string }>({ mode: "onChange", defaultValues: { target: "" } });

    useImperativeHandle(ref, () => ({
      present: () => {
        reset({ target: balance < 0 ? "" : balance.toFixed(2) });
        sheetRef.current?.present();
      },
    }));

    const onSubmit = handleSubmit(({ target }) => {
      sheetRef.current?.dismiss(async () => {
        try {
          await accounts.adjustBalance(account.id, parseFloat(target));
        } catch (e) {
          console.error("Adjust balance failed", e);
          Alert.alert("Adjust failed", "Something went wrong. Please try again.");
        }
      });
    });

    const isCredit = account.type === "credit";

    return (
      <AppBottomSheet
        ref={sheetRef}
        title="Adjust balance"
        snapPoints={CONTENT_HEIGHT_SNAP}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <View className="px-4 pb-4">
          <AppText variant="meta" className="mb-3">
            {isCredit ? "Currently owed" : "Current balance"} {formatAmount(balance)}. The difference is recorded as an
            adjustment.
          </AppText>
          <Controller
            control={control}
            name="target"
            rules={{ validate: (v) => v.trim() !== "" && !isNaN(parseFloat(v)) }}
            render={({ field: { value, onChange, onBlur } }) => (
              <AppTextInput
                autoFocus
                label={isCredit ? "Set amount owed to (₱)" : "Set balance to (₱)"}
                isAmount
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
              />
            )}
          />
          <AppButton label="Save balance" onPress={onSubmit} disabled={!isValid} className="mt-4" />
        </View>
      </AppBottomSheet>
    );
  }
);
