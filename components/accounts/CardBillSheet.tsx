import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { round } from "@/utils/round";
import { useAccounts } from "@/context/AccountContext";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef, type SheetFooter } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { isBillTbd } from "@/utils/cardBills";
import { paidAtFor } from "@/utils/dates/paidAtFor";
import { formatAmount } from "@/utils/formatAmount";
import type { CardBill } from "@/types";

export interface CardBillSheetRef {
  present: (bill: CardBill, footer?: SheetFooter) => void;
}

interface BillFormValues {
  amount: string;
}

interface PaymentFormValues {
  amount: string;
  paidAt: string;
  fromId: string;
  fee: string;
  note: string;
}

export const CardBillSheet = forwardRef<CardBillSheetRef>(function CardBillSheet(_props, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const sourceSheetRef = useRef<AccountPickerSheetRef>(null);
  const accounts = useAccounts();
  const { top } = useSafeAreaInsets();
  const sources = accounts.activeAccounts.filter((a) => a.type !== "credit");
  const [selected, setSelected] = useState<CardBill>();
  const [footer, setFooter] = useState<SheetFooter>();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting },
  } = useForm<BillFormValues>({ mode: "onChange", defaultValues: { amount: "" } });
  const payForm = useForm<PaymentFormValues>({
    mode: "onChange",
    defaultValues: { amount: "", paidAt: "", fromId: CASH_ACCOUNT_ID, fee: "", note: "" },
  });

  // Home's row can leave out what an older open bill still owes; the sheet always shows the full statement.
  const statementOf = (b: CardBill) =>
    accounts.getCardBills(b.year, b.month).find((s) => s.account.id === b.account.id) ?? b;
  const bill = selected && statementOf(selected);
  // A TBD bill starts blank: a prefilled "0.00" let one tap on Save mark it paid and drop it off Home.
  const amountField = (b: CardBill) => (isBillTbd(b) ? "" : b.amount.toFixed(2));
  // A TBD bill owes ₱0 so it reads as paid: it takes a statement amount before it can be paid.
  const isPayable = bill != null && !bill.isPaid;
  // A payment on or before the cut-off counts in the statement itself, not as paying this bill.
  const firstPayDay =
    bill && dayjs(bill.cutoff).isBefore(dayjs(), "day") ? dayjs(bill.cutoff).add(1, "day").toDate() : undefined;
  const paymentField = (owed: number) => (owed > 0 ? owed.toFixed(2) : "");
  const fromId = payForm.watch("fromId");
  const sourceName = sources.find((a) => a.id === fromId)?.name ?? "";

  useImperativeHandle(ref, () => ({
    present: (next, nextFooter) => {
      const statement = statementOf(next);
      setSelected(next);
      // A function given to a state setter runs as an updater, so wrap it.
      setFooter(() => nextFooter);
      reset({ amount: amountField(statement) });
      payForm.reset({
        amount: paymentField(statement.remaining),
        paidAt: new Date().toISOString(),
        fromId: sources[0]?.id ?? CASH_ACCOUNT_ID,
        fee: "",
        note: "",
      });
      sheetRef.current?.present();
    },
  }));

  // Until the payment is typed over, it follows the statement: what's left once the payments so far are taken off.
  function followStatement(statement: number | null) {
    if (!bill || payForm.getFieldState("amount").isDirty) {
      return;
    }
    const owed = statement == null ? bill.remaining : Math.max(0, round(statement - bill.paid, 2));
    payForm.setValue("amount", paymentField(owed), { shouldValidate: true });
  }

  async function saveAmount(amount: number | null) {
    if (!bill) {
      return;
    }
    try {
      await accounts.setBillAmount(bill.account.id, bill.year, bill.month, amount);
      reset({ amount: amountField({ ...bill, amount: amount ?? bill.estimate, isEstimate: amount == null }) });
      followStatement(amount ?? bill.estimate);
    } catch (e) {
      console.error("Save bill amount failed", e);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  }

  const onSave = handleSubmit(async ({ amount }) => {
    await saveAmount(parseFloat(amount));
  });

  async function payCard(cardId: string, { amount, paidAt, fromId: sourceId, fee, note }: PaymentFormValues) {
    try {
      await accounts.transfer({
        fromId: sourceId,
        toId: cardId,
        amount: parseFloat(amount),
        fee: fee === "" ? 0 : parseFloat(fee),
        income: 0,
        incomeCategory: "Other",
        incomeAccountId: cardId,
        note: note.trim() || null,
        createdAt: paidAt,
      });
    } catch (e) {
      console.error("Card payment failed", e);
      alertFailure("Payment failed", e);
    }
  }

  // Paying changes what the open sheet shows, so it runs once the sheet has closed.
  const onPay = payForm.handleSubmit((values) => {
    if (!bill) {
      return;
    }
    const cardId = bill.account.id;
    sheetRef.current?.dismiss(() => payCard(cardId, values));
  });

  return (
    <>
      <AppBottomSheet
        ref={sheetRef}
        title={bill ? `${bill.account.name} · ${dayjs(bill.dueDate).format("MMM D")} bill` : "Card bill"}
        snapPoints={CONTENT_HEIGHT_SNAP}
        topInset={top}
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
                  onChangeText={(text) => {
                    onChange(text);
                    const n = parseFloat(text);
                    followStatement(!isNaN(n) && n >= 0 ? n : null);
                  }}
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
            {isPayable && (
              <View className="mt-2 border-t border-border pt-3">
                <Controller
                  control={payForm.control}
                  name="amount"
                  rules={{
                    validate: (v) => {
                      const n = parseFloat(v);
                      return (!isNaN(n) && n >= 0.01) || "Enter what you paid";
                    },
                  }}
                  render={({ field: { value, onChange, onBlur }, fieldState }) => (
                    <AppTextInput
                      label="Payment (₱)"
                      isAmount
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="0.00"
                      error={fieldState.isTouched ? fieldState.error?.message : undefined}
                    />
                  )}
                />
                <Controller
                  control={payForm.control}
                  name="paidAt"
                  render={({ field: { value, onChange } }) => (
                    <AppDateField
                      label="Paid on"
                      value={value}
                      onChange={(iso) => onChange(paidAtFor(iso))}
                      minimumDate={firstPayDay}
                      maximumDate={new Date()}
                    />
                  )}
                />
                <View className="mt-2">
                  <AppSelectField
                    label="Pay from"
                    value={sourceName}
                    placeholder="Choose account"
                    onPress={() => sourceSheetRef.current?.present()}
                  />
                </View>
                <Controller
                  control={payForm.control}
                  name="fee"
                  rules={{
                    validate: (v) => {
                      if (v === "") {
                        return true;
                      }
                      const n = parseFloat(v);
                      return (!isNaN(n) && n >= 0) || "Must be ≥ 0";
                    },
                  }}
                  render={({ field: { value, onChange, onBlur }, fieldState }) => (
                    <AppTextInput
                      label="Payment fee (₱)"
                      isAmount
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Optional, charged on top"
                      error={fieldState.isTouched ? fieldState.error?.message : undefined}
                    />
                  )}
                />
                <Controller
                  control={payForm.control}
                  name="note"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <AppTextInput
                      label="Note"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Optional"
                      maxLength={100}
                    />
                  )}
                />
              </View>
            )}
            <View className="mt-4 gap-2">
              {isPayable ? (
                <>
                  <AppButton label="Pay bill" onPress={onPay} disabled={!payForm.formState.isValid} />
                  <AppButton
                    label="Save amount"
                    variant="tonal"
                    onPress={onSave}
                    disabled={!isValid}
                    loading={isSubmitting}
                  />
                </>
              ) : (
                <AppButton label="Save amount" onPress={onSave} disabled={!isValid} loading={isSubmitting} />
              )}
              {footer?.(() => sheetRef.current?.dismiss())}
              {!bill.isEstimate && <AppButton label="Use estimate" variant="ghost" onPress={() => saveAmount(null)} />}
            </View>
          </View>
        ) : null}
      </AppBottomSheet>
      <AccountPickerSheet
        ref={sourceSheetRef}
        options={sources}
        value={fromId}
        onChange={(id) => payForm.setValue("fromId", id, { shouldDirty: true, shouldValidate: true })}
      />
    </>
  );
});
