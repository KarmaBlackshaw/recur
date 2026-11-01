import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { router } from "expo-router";
import dayjs from "dayjs";
import { round } from "@/utils/round";
import { useAccounts } from "@/context/AccountContext";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { isBillTbd } from "@/utils/cardBills";
import { formatAmount } from "@/utils/formatAmount";
import type { CardBill } from "@/types";

export interface CardBillSheetRef {
  present: (bill: CardBill) => void;
}

interface BillFormValues {
  amount: string;
}

export const CardBillSheet = forwardRef<CardBillSheetRef>(function CardBillSheet(_props, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const accounts = useAccounts();
  const [selected, setSelected] = useState<CardBill>();
  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { isValid, isSubmitting },
  } = useForm<BillFormValues>({ mode: "onChange", defaultValues: { amount: "" } });

  // Home's row can leave out what an older open bill still owes; the sheet always shows the full statement.
  const statementOf = (b: CardBill) =>
    accounts.getCardBills(b.year, b.month).find((s) => s.account.id === b.account.id) ?? b;
  const bill = selected && statementOf(selected);
  // A TBD bill starts blank: a prefilled "0.00" let one tap on Save mark it paid and drop it off Home.
  const amountField = (b: CardBill) => (isBillTbd(b) ? "" : b.amount.toFixed(2));
  // Once the statement amount is known, paying is the main thing left to do here.
  const isPayable = bill != null && !bill.isPaid && !isBillTbd(bill);

  useImperativeHandle(ref, () => ({
    present: (next) => {
      setSelected(next);
      reset({ amount: amountField(statementOf(next)) });
      sheetRef.current?.present();
    },
  }));

  async function saveAmount(amount: number | null) {
    if (!bill) {
      return;
    }
    try {
      await accounts.setBillAmount(bill.account.id, bill.year, bill.month, amount);
      reset({ amount: amountField({ ...bill, amount: amount ?? bill.estimate, isEstimate: amount == null }) });
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
    router.push({ pathname: "/account/pay", params: { id: bill.account.id, amount: amount.toFixed(2) } });
  }

  return (
    <AppBottomSheet
      ref={sheetRef}
      title={bill ? `${bill.account.name} · ${dayjs(bill.dueDate).format("MMM D")} bill` : "Card bill"}
      snapPoints={CONTENT_HEIGHT_SNAP}
      scrollable
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {bill ? (
        <View className="px-4 pb-4">
          <AppDetailRow label="Cut-off" value={dayjs(bill.cutoff).format("MMM D")} />
          <AppDetailRow label="Estimate" value={formatAmount(bill.estimate)} />
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
                error={fieldState.isTouched ? fieldState.error?.message : undefined}
              />
            )}
          />
          <View className="mt-2 border-t border-border pt-2">
            <AppDetailRow label="Paid" value={formatAmount(bill.paid)} />
            <AppDetailRow label="Remaining" value={formatAmount(bill.remaining)} />
          </View>
          <View className="mt-4 gap-2">
            {isPayable ? (
              <>
                <AppButton label="Pay bill" onPress={payBill} />
                <AppButton
                  label="Save amount"
                  variant="tonal"
                  onPress={onSave}
                  disabled={!isValid}
                  loading={isSubmitting}
                />
              </>
            ) : (
              <>
                <AppButton label="Save amount" onPress={onSave} disabled={!isValid} loading={isSubmitting} />
                {!bill.isPaid && <AppButton label="Pay bill" variant="tonal" onPress={payBill} />}
              </>
            )}
            {!bill.isEstimate && <AppButton label="Use estimate" variant="ghost" onPress={() => saveAmount(null)} />}
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  );
});
