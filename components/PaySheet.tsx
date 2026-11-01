import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { CASH_ACCOUNT_ID, DELETED_ACCOUNT } from "@/constants/accounts";
import { getDueDateForMonth } from "@/utils/dateHelpers";
import { expenseTitle } from "@/utils/expenseHelpers";
import type { Expense } from "@/types";

export interface PayTarget {
  expense: Expense;
  year: number;
  month: number;
}

export interface PayConfirmation {
  amount: number;
  paidAt: string;
  // null: a month paid without any account (no balance changes).
  accountId: string | null;
}

export interface PaySheetControls {
  dismiss: () => void;
}

export interface PaySheetOptions {
  renderFooter?: (sheet: PaySheetControls) => React.ReactNode;
}

export interface PaySheetRef {
  present: (target: PayTarget, options?: PaySheetOptions) => void;
}

interface Props {
  onConfirm: (target: PayTarget, payment: PayConfirmation) => Promise<void>;
}

interface PayFormValues {
  amount: string;
  paidAt: string;
  accountId: string; // "" = no account
}

// How far back to look for a variable bill's last amount to prefill.
const AMOUNT_LOOKBACK_MONTHS = 12;
// No fixed snap points: the sheet sizes to the form.
const CONTENT_HEIGHT_SNAP: string[] = [];

// Today keeps the real time; earlier days count at the end of that day, like a one-off's paid date.
function paidAtFor(iso: string): string {
  const day = dayjs(iso);
  return day.isSame(dayjs(), "day") ? new Date().toISOString() : day.endOf("day").toISOString();
}

export const PaySheet = forwardRef<PaySheetRef, Props>(function PaySheet({ onConfirm }, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const [target, setTarget] = useState<PayTarget | null>(null);
  const [options, setOptions] = useState<PaySheetOptions>({});
  const { getDisplayAmount, getMonthAmount, getMonthPaidAt, getMonthStatus } = useExpenses();
  const { accounts, activeAccounts, transactions } = useAccounts();
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
    present: (next, nextOptions) => {
      const { expense, year, month } = next;
      const isPaid = getMonthStatus(expense.id, year, month) === "paid";
      const payment = transactions.find(
        (t) => t.kind === "payment" && t.expenseId === expense.id && t.cycleYear === year && t.cycleMonth === month
      );
      const usableAccount = (id: string) => (activeAccounts.some((a) => a.id === id) ? id : CASH_ACCOUNT_ID);
      const amount = lastKnownAmount(expense, year, month);
      // Editing a recorded payment starts from that payment: its own date (the due date for months paid before pay
      // dates were recorded) and its own account, archived or not, or none. A new payment starts from the bill.
      const paidAt = isPaid
        ? getMonthPaidAt(expense.id, year, month) ??
          payment?.createdAt ??
          dayjs(getDueDateForMonth(expense.dueDay, year, month)).endOf("day").toISOString()
        : new Date().toISOString();
      const accountId = isPaid
        ? payment?.accountId ?? ""
        : expense.accountId == null
          ? ""
          : usableAccount(expense.accountId);
      reset({ amount: amount != null ? amount.toFixed(2) : "", paidAt, accountId });
      setTarget(next);
      setOptions(nextOptions ?? {});
      sheetRef.current?.present();
    },
  }));

  const onSubmit = handleSubmit((values) => {
    if (!target) {
      return;
    }
    const payment: PayConfirmation = {
      amount: parseFloat(values.amount),
      paidAt: values.paidAt,
      accountId: values.accountId === "" ? null : values.accountId,
    };
    sheetRef.current?.dismiss(() => onConfirm(target, payment));
  });

  const accountId = watch("accountId");
  const dueDate = target ? dayjs(getDueDateForMonth(target.expense.dueDay, target.year, target.month)) : null;
  const isPaidAlready = target != null && getMonthStatus(target.expense.id, target.year, target.month) === "paid";
  const accountName = accountId === "" ? "No account" : accounts.find((a) => a.id === accountId)?.name ?? DELETED_ACCOUNT;
  const cycleLabel = target ? dayjs(new Date(target.year, target.month, 1)).format("MMMM") : "";

  return (
    <>
      <AppBottomSheet
        ref={sheetRef}
        title={
          target
            ? isPaidAlready
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
              {dueDate ? `${cycleLabel} bill · due ${dueDate.format("MMM D")}` : `${cycleLabel} bill`}
            </AppText>
            <Controller
              control={control}
              name="amount"
              rules={{
                validate: (v) => {
                  const n = parseFloat(v);
                  return (!isNaN(n) && n >= 0.01) || "Enter what you paid";
                },
              }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Amount (₱)"
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
              control={control}
              name="paidAt"
              render={({ field: { value, onChange } }) => (
                <AppDateField
                  label="Paid on"
                  value={value}
                  onChange={(iso) => onChange(paidAtFor(iso))}
                  maximumDate={new Date()}
                />
              )}
            />
            <View className="mt-2">
              <AppSelectField label="Pay from" value={accountName} onPress={() => accountSheetRef.current?.present()} />
            </View>
            <View className="mt-4 gap-2">
              <AppButton
                label={isPaidAlready ? "Save payment" : "Mark as paid"}
                onPress={onSubmit}
                disabled={!isValid}
              />
              {options.renderFooter?.({ dismiss: () => sheetRef.current?.dismiss() })}
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
