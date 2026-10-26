import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import { Controller, useForm } from "react-hook-form";
import { router } from "expo-router";
import dayjs from "dayjs";
import { round } from "@/utils/round";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { CardBill } from "@/types";

export interface CardBillSheetRef {
  present: (bill: CardBill) => void;
}

interface BillFormValues {
  amount: string;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <AppText variant="meta">{label}</AppText>
      <AppText variant="body-medium" className="text-sm">{value}</AppText>
    </View>
  );
}

export const CardBillSheet = forwardRef<CardBillSheetRef>(function CardBillSheet(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const accounts = useAccounts();
  const [selected, setSelected] = useState<CardBill>();
  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { isValid, isSubmitting },
  } = useForm<BillFormValues>({ mode: "onChange", defaultValues: { amount: "" } });

  const bill =
    selected &&
    (accounts
      .getCardBills(selected.year, selected.month)
      .find((b) => b.account.id === selected.account.id) ??
      selected);

  useImperativeHandle(ref, () => ({
    present: (next) => {
      setSelected(next);
      reset({ amount: next.amount.toFixed(2) });
      sheetRef.current?.present();
    },
  }));

  async function saveAmount(amount: number | null) {
    if (!bill) {
      return;
    }
    try {
      await accounts.setBillAmount(bill.account.id, bill.year, bill.month, amount);
      reset({ amount: (amount ?? bill.estimate).toFixed(2) });
    } catch (e) {
      console.error("Save bill amount failed", e);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  }

  const onSave = handleSubmit(async ({ amount }) => {
    await saveAmount(parseFloat(amount));
  });

  function payBill() {
    if (!bill) {
      return;
    }
    sheetRef.current?.dismiss();
    const typed = parseFloat(getValues("amount"));
    const amount = isValid && !isNaN(typed) ? Math.max(0, round(typed - bill.paid, 2)) : bill.remaining;
    router.push({ pathname: "/transfer", params: { accountId: bill.account.id, amount: amount.toFixed(2) } });
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    []
  );

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
        backdropComponent={renderBackdrop}
      >
        {bill ? (
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="px-5 pb-16">
              <View className="flex-row items-center justify-between mb-2">
                <AppText variant="title" accessibilityRole="header" className="shrink" numberOfLines={1}>
                  {`${bill.account.name} · ${dayjs(bill.dueDate).format("MMM D")} bill`}
                </AppText>
                <TouchableOpacity
                  className="w-11 h-11 items-center justify-center"
                  onPress={() => sheetRef.current?.dismiss()}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <InfoRow label="Cut-off" value={dayjs(bill.cutoff).format("MMM D")} />
              <InfoRow label="Estimate" value={formatAmount(bill.estimate)} />
              <Controller
                control={control}
                name="amount"
                rules={{
                  validate: (v) => {
                    const n = parseFloat(v);
                    return (!isNaN(n) && n >= 0) || "Must be ≥ 0";
                  },
                }}
                render={({ field: { value, onChange, onBlur }, fieldState }) => (
                  <AppTextInput
                    label="Statement amount (₱)"
                    isAmount
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0.00"
                    error={fieldState.error?.message}
                  />
                )}
              />
              <AppButton
                label="Save amount"
                onPress={onSave}
                disabled={!isValid}
                loading={isSubmitting}
                className="mt-2"
              />
              {!bill.isEstimate && (
                <AppButton label="Use estimate" variant="ghost" onPress={() => saveAmount(null)} className="mt-2" />
              )}
              <View className="mt-4 border-t border-border pt-2">
                <InfoRow label="Paid" value={formatAmount(bill.paid)} />
                <InfoRow label="Remaining" value={formatAmount(bill.remaining)} />
              </View>
              {!bill.isPaid && <AppButton label="Pay bill" variant="tonal" onPress={payBill} className="mt-4" />}
            </View>
          </BottomSheetScrollView>
        ) : null}
      </BottomSheetModal>
    </>
  );
});
