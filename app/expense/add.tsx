import React, { useRef } from "react";
import useBoolean from "ahooks/es/useBoolean";
import maxBy from "lodash/maxBy";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Feather } from "@expo/vector-icons";
import { useExpenses } from "@/context/ExpenseContext";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AccountPickerSheet, AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppCheckRow } from "@/components/ui/AppCheckRow";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import type { Recurrence, ExpenseFormValues } from "@/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";

const RECURRENCE_OPTIONS: { label: string; value: Recurrence }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

export default function AddExpenseScreen() {
  const { id, year: yearParam, month: monthParam, type } = useLocalSearchParams<{
    id?: string;
    year?: string;
    month?: string;
    type?: "regular" | "recurring";
  }>();
  const { addExpense, updateExpense, expenses, getMonthAmount } = useExpenses();
  const now = new Date();
  const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const currentMonth = monthParam ? parseInt(monthParam, 10) : now.getMonth();
  const editingExpense = id ? expenses.find((e) => e.id === id) ?? null : null;
  const isEditing = editingExpense !== null;
  const isRegular = isEditing ? editingExpense!.recurrence === "one-off" : type === "regular";
  const lastUsedCategory = maxBy(expenses, "createdAt")?.category ?? "Other";
  const lastUsedAccountId = maxBy(expenses.filter((e) => e.accountId), "createdAt")?.accountId;
  const initialAccountId = editingExpense ? editingExpense.accountId : lastUsedAccountId;
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const { accounts, isLoading: isAccountsLoading } = useAccounts();

  function toKnownAccountId(accountId?: string | null) {
    return accountId && accounts.some((a) => a.id === accountId) ? accountId : CASH_ACCOUNT_ID;
  }
  const [isPaidPickerOpen, paidPicker] = useBoolean();
  const [isEndPickerOpen, endPicker] = useBoolean();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { isValid, isSubmitting, errors },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      amount: editingExpense?.amount != null ? editingExpense.amount.toString() : "",
      category: editingExpense?.category ?? lastUsedCategory,
      dueDay: editingExpense?.dueDay?.toString() ?? "1",
      recurrence: editingExpense?.recurrence ?? (type === "regular" ? "one-off" : "monthly"),
      isVariable: editingExpense?.isVariable ?? false,
      notes: editingExpense?.notes || editingExpense?.name || "",
      reminderDaysBefore: '',
      paidDate: editingExpense?.paidDate ?? new Date().toISOString(),
      hasEndDate: editingExpense?.endYear != null,
      endDate:
        editingExpense?.endYear != null
          ? new Date(editingExpense.endYear, editingExpense.endMonth ?? 0, 1).toISOString()
          : new Date().toISOString(),
      accountId: toKnownAccountId(initialAccountId),
    },
  });

  const isVariableWatched = watch("isVariable");
  const hasEndDateWatched = watch("hasEndDate");
  const accountIdWatched = watch("accountId");
  const payCard = isRegular
    ? undefined
    : accounts.find((a) => a.id === accountIdWatched && a.type === "credit");
  const isVariableAmount = !!payCard || isVariableWatched;

  React.useEffect(() => {
    if (
      !isAccountsLoading &&
      getValues("accountId") === CASH_ACCOUNT_ID
    ) {
      setValue("accountId", toKnownAccountId(initialAccountId));
    }
  }, [isAccountsLoading]);

  React.useEffect(() => {
    if (editingExpense) {
      const existingMonthlyAmount = editingExpense.isVariable
        ? getMonthAmount(editingExpense.id, currentYear, currentMonth)
        : null;
      reset({
        amount: editingExpense.isVariable
          ? (existingMonthlyAmount != null ? existingMonthlyAmount.toString() : "")
          : (editingExpense.amount != null ? editingExpense.amount.toString() : ""),
        category: editingExpense.category,
        dueDay: editingExpense.dueDay.toString(),
        recurrence: editingExpense.recurrence,
        isVariable: editingExpense.isVariable,
        monthlyAmount: "",
        notes: editingExpense.notes || editingExpense.name || "",
        reminderDaysBefore: editingExpense.reminderDaysBefore != null ? editingExpense.reminderDaysBefore.toString() : '',
        paidDate: editingExpense.paidDate ?? new Date().toISOString(),
        hasEndDate: editingExpense.endYear != null,
        endDate:
          editingExpense.endYear != null
            ? new Date(editingExpense.endYear, editingExpense.endMonth ?? 0, 1).toISOString()
            : new Date().toISOString(),
        accountId: toKnownAccountId(editingExpense.accountId),
      });
    }
  }, [editingExpense?.id]);

  const onSubmit = handleSubmit(async (data) => {
    const isVar = isRegular ? false : !!payCard || data.isVariable;
    const parsedAmount = data.amount.trim() !== "" ? parseFloat(data.amount) : null;
    const endActive = !isRegular && data.hasEndDate;
    const endParsed = endActive ? dayjs(data.endDate).toDate() : null;

    const fields = {
      name: "",
      amount: isVar ? null : parsedAmount,
      category: data.category,
      dueDay: isRegular ? 1 : payCard ? payCard.dueDay ?? 1 : parseInt(data.dueDay, 10),
      recurrence: isRegular ? "one-off" : data.recurrence,
      isVariable: isVar,
      status: editingExpense?.status ?? "unpaid",
      notes: data.notes.trim() || undefined,
      reminderDaysBefore: isRegular || payCard ? null : (data.reminderDaysBefore.trim() === '' ? null : parseInt(data.reminderDaysBefore, 10)),
      paidDate: isRegular ? data.paidDate : null,
      endYear: endParsed ? endParsed.getFullYear() : null,
      endMonth: endParsed ? endParsed.getMonth() : null,
      accountId: data.accountId,
    };

    try {
      if (isEditing && id) {
        await updateExpense(id, fields, isVar ? {
          year: currentYear,
          month: currentMonth,
          amount: parsedAmount,
        } : undefined);
      } else {
        await addExpense(fields, isVar ? {
          year: currentYear,
          month: currentMonth,
          amount: parsedAmount,
        } : undefined);
      }
      reset();
      router.back();
    } catch {
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  });

  const saveHint = Object.keys(errors).length
    ? "Fix the highlighted fields to save"
    : "Fill in the required fields to save";

  function handleCancel() {
    reset();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
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
          {isRegular
            ? (isEditing ? "Edit Expense" : "Add Expense")
            : (isEditing ? "Edit Recurring Expense" : "Add Recurring Expense")}
        </AppText>
        <View className="w-11" />
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Date — Paid Date (one-off) or Due Day (recurring). Prefilled, so Amount is focused first. */}
        {isRegular && (
          <Controller
            control={control}
            name="paidDate"
            render={({ field: { value, onChange } }) => (
              <>
                <AppLabel>Paid Date</AppLabel>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                  onPress={paidPicker.setTrue}
                  accessibilityRole="button"
                  accessibilityLabel={`Paid date, ${dayjs(value).format("MMM D, YYYY")}`}
                >
                  <AppText variant="body-medium" className="text-white text-base">
                    {dayjs(value).format("MMM D, YYYY")}
                  </AppText>
                  <Feather name="calendar" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {isPaidPickerOpen && (
                  <DateTimePicker
                    value={dayjs(value).toDate()}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                      paidPicker.setFalse();
                      if (event.type === "set" && date) {
                        onChange(dayjs(date).startOf("day").toISOString());
                      }
                    }}
                  />
                )}
              </>
            )}
          />
        )}
        {!isRegular && !payCard && (
          <Controller
            control={control}
            name="dueDay"
            rules={{
              required: true,
              validate: (v) => {
                const n = parseInt(v, 10);
                return (!isNaN(n) && n >= 1 && n <= 31) || "Must be 1–31";
              },
            }}
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <AppTextInput
                label="Due Day (1–31)"
                error={fieldState.error?.message}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="1"
                keyboardType="number-pad"
                maxLength={2}
              />
            )}
          />
        )}

        {/* Amount — focused first (date is prefilled) */}
        <Controller
          control={control}
          name="amount"
          rules={{
            validate: (v) => {
              if (isVariableAmount) {
                return true;
              }
              if (v === "" || v === undefined) {
                return true;
              }
              const n = parseFloat(v);
              return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              autoFocus
              label={isVariableAmount ? "This Month's Amount (₱)" : "Amount (₱)"}
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              error={fieldState.error?.message}
            />
          )}
        />

        {/* Category */}
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

        <AppLabel>Pay from</AppLabel>
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
                accessibilityLabel={`Pay from, ${accountName}`}
              >
                <AppText variant="body-medium" className="text-white text-base">{accountName}</AppText>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
        {payCard && (
          <AppText variant="caption" className="px-1 mb-3">
            {payCard.dueDay != null ? `Due with the card bill (day ${payCard.dueDay})` : "Due with the card bill"}
          </AppText>
        )}

        {/* Recurring-only fields */}
        {!isRegular && (
          <>
            <Controller
              control={control}
              name="recurrence"
              render={({ field: { value, onChange } }) => (
                <AppRadioGroup
                  label="Recurrence"
                  options={RECURRENCE_OPTIONS}
                  value={value}
                  onChange={onChange}
                  className="mb-3"
                />
              )}
            />

            {!payCard && (
              <Controller
                control={control}
                name="isVariable"
                render={({ field: { value, onChange } }) => (
                  <AppCheckRow
                    label="Variable amount"
                    description="Amount changes each month"
                    checked={value}
                    onToggle={onChange}
                  />
                )}
              />
            )}

            <Controller
              control={control}
              name="hasEndDate"
              render={({ field: { value, onChange } }) => (
                <AppCheckRow
                  label="Set an end month"
                  description="Stops recurring after this month"
                  checked={value}
                  onToggle={onChange}
                />
              )}
            />
            {hasEndDateWatched && (
              <Controller
                control={control}
                name="endDate"
                render={({ field: { value, onChange } }) => (
                  <>
                    <AppLabel>Ends</AppLabel>
                    <TouchableOpacity
                      className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                      onPress={endPicker.setTrue}
                      accessibilityRole="button"
                      accessibilityLabel={`Ends, ${dayjs(value).format("MMM YYYY")}`}
                    >
                      <AppText variant="body-medium" className="text-white text-base">
                        {dayjs(value).format("MMM YYYY")}
                      </AppText>
                      <Feather name="calendar" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    {isEndPickerOpen && (
                      <DateTimePicker
                        value={dayjs(value).toDate()}
                        mode="date"
                        minimumDate={new Date(now.getFullYear(), now.getMonth(), 1)}
                        onChange={(event, date) => {
                          endPicker.setFalse();
                          if (event.type === "set" && date) {
                            onChange(new Date(date.getFullYear(), date.getMonth(), 1).toISOString());
                          }
                        }}
                      />
                    )}
                  </>
                )}
              />
            )}

            {!payCard && (
              <>
                <Controller
                  control={control}
                  name="reminderDaysBefore"
                  rules={{
                    validate: (v) => {
                      if (!v || v.trim() === '') {
                        return true;
                      }
                      const n = parseInt(v, 10);
                      return (!isNaN(n) && n >= 1 && n <= 14) || 'Must be 1–14';
                    },
                  }}
                  render={({ field: { value, onChange, onBlur }, fieldState }) => (
                    <AppTextInput
                      label="Remind me (days before)"
                      error={fieldState.error?.message}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="1"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  )}
                />
                <AppText variant="caption" className="px-1 mb-3">
                  Leave blank for default (1 day before due)
                </AppText>
              </>
            )}
          </>
        )}

        {/* Notes — replaces the old Name field; serves as the expense title */}
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Notes"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Netflix"
              multiline
              maxLength={200}
            />
          )}
        />

        {/* Save */}
        <AppButton
          label={isEditing ? "Save Changes" : "Save Expense"}
          onPress={onSubmit}
          disabled={!isValid || isAccountsLoading}
          loading={isSubmitting}
          accessibilityHint={isValid ? undefined : saveHint}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">{saveHint}</AppText>
        )}

        <View className="h-8" />
      </ScrollView>

      <Controller
        control={control}
        name="category"
        render={({ field: { value, onChange } }) => (
          <CategoryBottomSheet
            ref={categorySheetRef}
            value={value}
            onChange={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet ref={accountSheetRef} value={value} onChange={onChange} />
        )}
      />
    </SafeAreaView>
  );
}
