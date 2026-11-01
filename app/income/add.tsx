import React, { useRef } from "react";
import { maxBy } from "@/utils/collections";
import { View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AccountPickerSheet, AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { TransferInButton } from "@/components/accounts/TransferInButton";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { alertFailure } from "@/utils/accounts/alertFailure";
import type { AccountTransaction } from "@/types";
import dayjs from "dayjs";

// Amount is the only field that can be invalid.
const SAVE_HINT = "Enter an amount to save";

interface IncomeFormValues {
  receivedAt: string;
  amount: string;
  category: string;
  accountId: string;
  notes: string;
}

export default function AddIncomeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accounts, activeAccounts, transactions, isLoading, overdraftError, addIncome, updateIncome, deleteIncome } =
    useAccounts();
  const incomes = transactions.filter((t) => t.kind === "income");
  const editingIncome = id ? incomes.find((t) => t.id === id) : undefined;
  const isEditing = editingIncome != null;
  // Transfer and loan income ride on their own forms, so a new entry defaults from the last one typed in here.
  const lastIncome = maxBy(incomes.filter((t) => t.transferId == null && t.loanId == null), "createdAt");
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);

  const depositAccounts = activeAccounts.filter((a) => a.type !== "credit");

  // An income already in an archived account keeps it when edited; new income only defaults to accounts in use.
  function toKnownAccountId(accountId: string | undefined, canBeArchived: boolean) {
    const pool = canBeArchived ? accounts.filter((a) => a.type !== "credit") : depositAccounts;
    return accountId && pool.some((a) => a.id === accountId) ? accountId : CASH_ACCOUNT_ID;
  }

  function toFormValues(income?: AccountTransaction): IncomeFormValues {
    if (income) {
      return {
        receivedAt: income.createdAt,
        amount: income.amount.toString(),
        category: income.category ?? "Salary",
        accountId: toKnownAccountId(income.accountId, true),
        notes: income.note ?? "",
      };
    }
    return {
      receivedAt: dayjs().startOf("day").toISOString(),
      amount: "",
      category: lastIncome?.category ?? "Salary",
      accountId: toKnownAccountId(lastIncome?.accountId, false),
      notes: "",
    };
  }

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    trigger,
    formState: { isDirty, isValid, isSubmitting },
  } = useForm<IncomeFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(editingIncome),
  });
  const { allowLeave } = useDiscardGuard(isDirty);

  React.useEffect(() => {
    if (!isLoading) {
      reset(toFormValues(editingIncome));
    }
  }, [isLoading, editingIncome?.id]);

  React.useEffect(() => {
    if (getValues("amount")) {
      trigger("amount");
    }
  }, [transactions]);

  function amountOverdraft(amount: string) {
    if (!isEditing) {
      return undefined;
    }
    return overdraftError([{ accountId: getValues("accountId"), amount: parseFloat(amount) }], (t) => t.id === id);
  }

  const onSubmit = handleSubmit(async (data) => {
    const input = {
      accountId: data.accountId,
      amount: parseFloat(data.amount),
      category: data.category,
      note: data.notes.trim() || null,
      receivedAt: data.receivedAt,
    };

    try {
      if (isEditing && id) {
        await updateIncome(id, input);
      } else {
        await addIncome(input);
      }
      allowLeave();
      router.back();
    } catch (error) {
      console.error(error);
      alertFailure("Save failed", error);
    }
  });

  function handleDelete() {
    if (!id) {
      return;
    }
    Alert.alert("Delete income?", "This removes it and updates the account balance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteIncome(id);
            allowLeave();
            router.back();
          } catch (error) {
            console.error(error);
            alertFailure("Delete failed", error);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={isEditing ? "Edit income" : "Add income"}
        action={{
          label: "Save",
          onPress: onSubmit,
          isDisabled: !isValid || isLoading,
          isLoading: isSubmitting,
          accessibilityHint: isValid ? undefined : SAVE_HINT,
        }}
      />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="receivedAt"
          render={({ field: { value, onChange } }) => (
            <AppDateField label="Received date" value={value} onChange={onChange} maximumDate={new Date()} />
          )}
        />

        <Controller
          control={control}
          name="amount"
          rules={{
            required: "Enter an amount",
            validate: (v) => {
              const n = parseFloat(v);
              if (isNaN(n) || n < 0.01) {
                return "Must be ≥ 0.01";
              }
              return amountOverdraft(v)?.message ?? true;
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <AppTextInput
                autoFocus={!isEditing}
                label="Amount (₱)"
                isAmount
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                error={fieldState.isTouched || amountOverdraft(value) ? fieldState.error?.message : undefined}
              />
              <TransferInButton fieldError={fieldState.error?.message} overdraft={amountOverdraft(value)} />
            </>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { value } }) => (
            <AppSelectField label="Category" value={value} onPress={() => categorySheetRef.current?.present()} />
          )}
        />

        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => (
            <AppSelectField
              label="Deposit to"
              value={accounts.find((a) => a.id === value)?.name ?? "Cash"}
              onPress={() => accountSheetRef.current?.present()}
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Notes"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. October pay"
              multiline
              maxLength={200}
            />
          )}
        />

        <AppButton
          label={isEditing ? "Save changes" : "Save income"}
          onPress={onSubmit}
          disabled={!isValid || isLoading}
          loading={isSubmitting}
          accessibilityHint={isValid ? undefined : SAVE_HINT}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">{SAVE_HINT}</AppText>
        )}
        {isEditing && (
          <AppButton
            label="Delete income"
            variant="destructive"
            onPress={handleDelete}
            className="mt-3"
          />
        )}

        <View className="h-8" />
      </AppFormScrollView>

      <Controller
        control={control}
        name="category"
        render={({ field: { value, onChange } }) => (
          <CategoryBottomSheet
            ref={categorySheetRef}
            kind="income"
            value={value}
            onChange={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet
            ref={accountSheetRef}
            title="Deposit to"
            options={depositAccounts}
            value={value}
            onChange={(accountId) => {
              onChange(accountId);
              if (getValues("amount")) {
                trigger("amount");
              }
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}
