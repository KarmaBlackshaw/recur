import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { Account } from "@/types";

export interface AdjustBalanceSheetRef {
  present: () => void;
}

export const AdjustBalanceSheet = forwardRef<AdjustBalanceSheetRef, { account: Account }>(
  function AdjustBalanceSheet({ account }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const accounts = useAccounts();
    const balance = accounts.getBalance(account.id);
    const {
      control,
      handleSubmit,
      reset,
      formState: { isValid, isSubmitting },
    } = useForm<{ target: string }>({ mode: "onChange", defaultValues: { target: "" } });

    useImperativeHandle(ref, () => ({
      present: () => {
        reset({ target: balance < 0 ? "" : balance.toFixed(2) });
        sheetRef.current?.present();
      },
    }));

    const onSubmit = handleSubmit(async ({ target }) => {
      try {
        await accounts.adjustBalance(account.id, parseFloat(target));
        sheetRef.current?.dismiss();
      } catch (e) {
        console.error("Adjust balance failed", e);
        Alert.alert("Adjust failed", "Something went wrong. Please try again.");
      }
    });

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      []
    );

    const isCredit = account.type === "credit";

    return (
      <BottomSheetModal
        ref={sheetRef}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView className="px-5 pb-10">
          <View className="flex-row items-center justify-between mb-2">
            <AppText variant="title" accessibilityRole="header">Adjust balance</AppText>
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center"
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
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
          <AppButton
            label="Save balance"
            onPress={onSubmit}
            disabled={!isValid}
            loading={isSubmitting}
            className="mt-4"
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
