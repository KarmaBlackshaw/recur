import React, { useRef } from "react";
import useBoolean from "ahooks/es/useBoolean";
import maxBy from "lodash/maxBy";
import { View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Feather } from "@expo/vector-icons";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AccountPickerSheet, AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import type { AccountTransaction } from "@/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";

interface IncomeFormValues {
  receivedAt: string;
  amount: string;
  category: string;
  accountId: string;
  notes: string;
}

export default function AddIncomeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accounts, transactions, isLoading, addIncome, updateIncome, deleteIncome } = useAccounts();
  const incomes = transactions.filter((t) => t.kind === "income");
  const editingIncome = id ? incomes.find((t) => t.id === id) : undefined;
  const isEditing = editingIncome != null;
  const lastIncome = maxBy(incomes.filter((t) => t.transferId == null), "createdAt");
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const [isDatePickerOpen, datePicker] = useBoolean();

  const depositAccounts = accounts.filter((a) => a.type !== "credit");

  function toKnownAccountId(accountId?: string) {
    return accountId && depositAccounts.some((a) => a.id === accountId) ? accountId : CASH_ACCOUNT_ID;
  }

  function toFormValues(income?: AccountTransaction): IncomeFormValues {
    if (income) {
      return {
        receivedAt: income.createdAt,
        amount: income.amount.toString(),
        category: income.category ?? "Salary",
        accountId: toKnownAccountId(income.accountId),
        notes: income.note ?? "",
      };
    }
    return {
      receivedAt: dayjs().startOf("day").toISOString(),
      amount: "",
      category: lastIncome?.category ?? "Salary",
      accountId: toKnownAccountId(lastIncome?.accountId),
      notes: "",
    };
  }

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting, errors },
  } = useForm<IncomeFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(editingIncome),
  });

  React.useEffect(() => {
    if (!isLoading) {
      reset(toFormValues(editingIncome));
    }
  }, [isLoading, editingIncome?.id]);

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
      reset();
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
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
            router.back();
          } catch (error) {
            console.error(error);
            Alert.alert("Delete failed", "Something went wrong. Please try again.");
          }
        },
      },
    ]);
  }

  const saveHint = Object.keys(errors).length
    ? "Fix the highlighted fields to save"
    : "Fill in the required fields to save";

  function handleCancel() {
    reset();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity
          onPress={handleCancel}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="title" className="flex-1 text-center" numberOfLines={1} adjustsFontSizeToFit>
          {isEditing ? "Edit Income" : "Add Income"}
        </AppText>
        <View className="w-11" />
      </View>

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="receivedAt"
          render={({ field: { value, onChange } }) => (
            <>
              <AppLabel>Received Date</AppLabel>
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                onPress={datePicker.setTrue}
                accessibilityRole="button"
                accessibilityLabel={`Received date, ${dayjs(value).format("MMM D, YYYY")}`}
              >
                <AppText variant="body-medium" className="text-white text-base">
                  {dayjs(value).format("MMM D, YYYY")}
                </AppText>
                <Feather name="calendar" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {isDatePickerOpen && (
                <DateTimePicker
                  value={dayjs(value).toDate()}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    datePicker.setFalse();
                    if (event.type === "set" && date) {
                      onChange(dayjs(date).startOf("day").toISOString());
                    }
                  }}
                />
              )}
            </>
          )}
        />

        <Controller
          control={control}
          name="amount"
          rules={{
            required: true,
            validate: (v) => {
              const n = parseFloat(v);
              return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              autoFocus
              label="Amount (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              error={fieldState.error?.message}
            />
          )}
        />

        <AppLabel>Category</AppLabel>
        <Controller
          control={control}
          name="category"
          render={({ field: { value } }) => (
            <TouchableOpacity
              className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
              onPress={() => categorySheetRef.current?.present()}
              accessibilityRole="button"
              accessibilityLabel={`Category, ${value}`}
            >
              <AppText variant="body-medium" className="text-white text-base">{value}</AppText>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />

        <AppLabel>Deposit to</AppLabel>
        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => {
            const accountName = accounts.find((a) => a.id === value)?.name ?? "Cash";
            return (
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                onPress={() => accountSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={`Deposit to, ${accountName}`}
              >
                <AppText variant="body-medium" className="text-white text-base">{accountName}</AppText>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
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
          label={isEditing ? "Save Changes" : "Save Income"}
          onPress={onSubmit}
          disabled={!isValid || isLoading}
          loading={isSubmitting}
          accessibilityHint={isValid ? undefined : saveHint}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">{saveHint}</AppText>
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
            onChange={onChange}
          />
        )}
      />
    </SafeAreaView>
  );
}
