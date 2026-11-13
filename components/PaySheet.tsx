import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { AppBottomSheet, type AppBottomSheetRef, type SheetFooter } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { formatDaysLate, getDueDateForMonth, isOverdueOn } from "@/utils/dateHelpers";
import { stampPickedDay } from "@/utils/dates/stampPickedDay";
import { expenseTitle } from "@/utils/expenseHelpers";
import { billProgress, canPayPart } from "@/utils/expenses/billProgress";
import { formatAmount } from "@/utils/formatAmount";
import { payFromAccountId } from "@/utils/accounts/payFromAccountId";
import type { Expense } from "@/types";

export interface PayTarget {
  expense: Expense;
  year: number;
  month: number;
  paymentId?: string;
}

export interface PayConfirmation {
  amount: number;
  paidAt: string;
  accountId: string;
  mode: "settle" | "part" | "edit";
}

export interface PaySheetRef {
  present: (target: PayTarget, footer?: SheetFooter) => void;
}

interface Props {
  onConfirm: (target: PayTarget, payment: PayConfirmation) => Promise<void>;
}

interface PayFormValues {
  amount: string;
  paidAt: string;
  accountId: string;
}

// How far back to look for a variable bill's last amount to prefill.
const AMOUNT_LOOKBACK_MONTHS = 12;
// No fixed snap points: the sheet sizes to the form.
const CONTENT_HEIGHT_SNAP: string[] = [];

export const PaySheet = forwardRef<PaySheetRef, Props>(function PaySheet({ onConfirm }, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const [target, setTarget] = useState<PayTarget | null>(null);
  const [footer, setFooter] = useState<SheetFooter>();
  const { getBillProgress, getDisplayAmount, getMonthAmount, getMonthPaidAt, getMonthStatus } = useExpenses();
  const { nameOf, activeAccounts, getPayments } = useAccounts();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isValid },
  } = useForm<PayFormValues>({ mode: "onChange", defaultValues: { amount: "", paidAt: "", accountId: CASH_ACCOUNT_ID } });

  function lastKnownAmount(expense: Expense, year: number, month: number): number | null {
    for (let back = 0; back <= AMOUNT_LOOKBACK_MONTHS; back++) {
      const at = dayjs(new Date(year, month, 1)).subtract(back, "month");
      const amount = back === 0 ? getDisplayAmount(expense, year, month) : getMonthAmount(expense.id, at.year(), at.month());
      if (amount != null) {
        return amount;
      }
    }
    return null;
  }

  useImperativeHandle(ref, () => ({
    present: (next, nextFooter) => {
      const { expense, year, month } = next;
      const isPaid = getMonthStatus(expense.id, year, month) === "paid";
      const payments = getPayments(expense.id, year, month);
      const editing = payments.find((t) => t.id === next.paymentId) ?? (isPaid ? payments.at(-1) : undefined);
      if (editing) {
        reset({ amount: Math.abs(editing.amount).toFixed(2), paidAt: editing.createdAt, accountId: editing.accountId });
      } else {
        const progress = getBillProgress(expense, year, month);
        const amount = progress.paid > 0 ? progress.left : lastKnownAmount(expense, year, month);
        // Months paid before pay dates were recorded date by their due date.
        const paidAt = isPaid
          ? getMonthPaidAt(expense.id, year, month) ??
            dayjs(getDueDateForMonth(expense.dueDay, year, month)).endOf("day").toISOString()
          : new Date().toISOString();
        reset({
          amount: amount != null ? amount.toFixed(2) : "",
          paidAt,
          accountId: payFromAccountId(expense, activeAccounts),
        });
      }
      setTarget({ ...next, paymentId: editing?.id });
      // A function given to a state setter runs as an updater, so wrap it.
      setFooter(() => nextFooter);
      sheetRef.current?.present();
    },
  }));

  const submit = (mode: PayConfirmation["mode"]) =>
    handleSubmit((values) => {
      if (!target) {
        return;
      }
      const payment: PayConfirmation = {
        amount: parseFloat(values.amount),
        paidAt: values.paidAt,
        accountId: values.accountId,
        mode,
      };
      sheetRef.current?.dismiss(() => onConfirm(target, payment));
    });

  const accountId = watch("accountId");
  const parsedAmount = parseFloat(watch("amount"));
  const dueDate = target ? dayjs(getDueDateForMonth(target.expense.dueDay, target.year, target.month)) : null;
  const isPaidAlready = target != null && getMonthStatus(target.expense.id, target.year, target.month) === "paid";
  const isEditingPayment = target?.paymentId != null;
  const progress =
    target && !isEditingPayment && !isPaidAlready ? getBillProgress(target.expense, target.year, target.month) : null;
  const editProgress =
    target && isEditingPayment && !isPaidAlready
      ? billProgress({
          bill: getDisplayAmount(target.expense, target.year, target.month),
          payments: getPayments(target.expense.id, target.year, target.month)
            .filter((t) => t.id !== target.paymentId)
            .map((t) => Math.abs(t.amount)),
          isPaid: false,
        })
      : null;
  const latestPaidAt =
    target && progress ? getPayments(target.expense.id, target.year, target.month).at(-1)?.createdAt : undefined;
  const isCoveringBill = progress?.left != null && parsedAmount > 0 && !canPayPart(progress, parsedAmount);
  const accountName = nameOf(accountId);
  const cycleLabel = target ? dayjs(new Date(target.year, target.month, 1)).format("MMMM") : "";
  const lateText =
    target && dueDate && !isPaidAlready && isOverdueOn(target.expense.dueDay, target.year, target.month)
      ? ` · ${formatDaysLate(dueDate.toDate())}`
      : "";

  return (
    <>
      <AppBottomSheet
        ref={sheetRef}
        title={
          target
            ? progress == null
              ? `Edit ${expenseTitle(target.expense)} payment`
              : `Pay ${expenseTitle(target.expense)}`
            : "Pay"
        }
        snapPoints={CONTENT_HEIGHT_SNAP}
        scrollable
        keyboardBlurBehavior="restore"
      >
        {target ? (
          <View className="px-5 pb-4">
            <AppText variant="meta" className="-mt-2 mb-2">
              {dueDate ? `${cycleLabel} bill · due ${dueDate.format("MMM D")}${lateText}` : `${cycleLabel} bill`}
            </AppText>
            {progress && progress.paid > 0 ? (
              <View className="mb-2">
                <AppDetailRow label="Paid so far" value={formatAmount(progress.paid)} />
                {progress.left != null && <AppDetailRow label="Left" value={formatAmount(progress.left)} />}
              </View>
            ) : null}
            <Controller
              control={control}
              name="paidAt"
              render={({ field: { value, onChange } }) => (
                <AppDateField
                  label="Paid on"
                  value={value}
                  onChange={(iso) => onChange(stampPickedDay(iso))}
                  minimumDate={latestPaidAt ? dayjs(latestPaidAt).toDate() : undefined}
                  maximumDate={new Date()}
                />
              )}
            />
            <AppSelectField label="Pay from" value={accountName} onPress={() => accountSheetRef.current?.present()} />
            <Controller
              control={control}
              name="amount"
              rules={{
                validate: (v) => {
                  const n = parseFloat(v);
                  if (isNaN(n) || !(isEditingPayment ? n > 0 : n >= 0)) {
                    return "Enter what you paid";
                  }
                  return (
                    editProgress == null ||
                    canPayPart(editProgress, n) ||
                    "That covers the bill — delete this payment and use Mark as paid"
                  );
                },
              }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <>
                  <AppTextInput
                    label="Amount (₱)"
                    isAmount
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0.00"
                    error={fieldState.isTouched ? fieldState.error?.message : undefined}
                  />
                  {fieldState.isDirty && isCoveringBill ? (
                    <AppText variant="meta" className="mb-1">That covers the bill — use Mark as paid</AppText>
                  ) : null}
                </>
              )}
            />
            <View className="mt-4 gap-2">
              {progress ? (
                <>
                  <AppButton label="Mark as paid" onPress={submit("settle")} disabled={!isValid} />
                  <AppButton
                    label="Pay part, rest later"
                    variant="tonal"
                    onPress={submit("part")}
                    disabled={!isValid || !canPayPart(progress, parsedAmount)}
                  />
                </>
              ) : (
                <AppButton
                  label="Save payment"
                  onPress={submit(isEditingPayment ? "edit" : "settle")}
                  disabled={!isValid}
                />
              )}
              {footer?.(() => sheetRef.current?.dismiss())}
            </View>
          </View>
        ) : null}
      </AppBottomSheet>
      <AccountPickerSheet
        ref={accountSheetRef}
        title="Pay from"
        options={activeAccounts}
        value={accountId}
        onChange={(id) => setValue("accountId", id, { shouldDirty: true })}
      />
    </>
  );
});
