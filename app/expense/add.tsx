import React, { useRef, useState } from "react";
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
import { useExpenses } from "../../context/ExpenseContext";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "../../components/CategoryBottomSheet";
import { AppButton } from "../../components/ui/AppButton";
import { AppText } from "../../components/ui/AppText";
import { AppTextInput } from "../../components/ui/AppTextInput";
import { AppRadioGroup } from "../../components/ui/AppRadioGroup";
import { colors } from "../../constants/theme";
import type { Recurrence, ExpenseFormValues } from "../../types";
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
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const [showPaidPicker, setShowPaidPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isValid },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      amount: editingExpense?.amount != null ? editingExpense.amount.toString() : "",
      category: editingExpense?.category ?? "Other",
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
    },
  });

  const isVariableWatched = watch("isVariable");
  const hasEndDateWatched = watch("hasEndDate");

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
      });
    }
  }, [editingExpense?.id]);

  const onSubmit = handleSubmit(async (data) => {
    const isVar = isRegular ? false : data.isVariable;
    const parsedAmount = data.amount.trim() !== "" ? parseFloat(data.amount) : null;
    const endActive = !isRegular && data.hasEndDate;
    const endParsed = endActive ? dayjs(data.endDate).toDate() : null;

    const fields = {
      name: "",
      amount: isVar ? null : parsedAmount,
      category: data.category,
      dueDay: isRegular ? 1 : parseInt(data.dueDay, 10),
      recurrence: isRegular ? "one-off" : data.recurrence,
      isVariable: isVar,
      status: editingExpense?.status ?? "unpaid",
      notes: data.notes.trim() || undefined,
      reminderDaysBefore: isRegular ? null : (data.reminderDaysBefore.trim() === '' ? null : parseInt(data.reminderDaysBefore, 10)),
      paidDate: isRegular ? data.paidDate : null,
      endYear: endParsed ? endParsed.getFullYear() : null,
      endMonth: endParsed ? endParsed.getMonth() : null,
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

  function handleCancel() {
    reset();
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity onPress={handleCancel} className="p-1">
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-[22px]">
          {isRegular
            ? (isEditing ? "Edit Expense" : "Add Expense")
            : (isEditing ? "Edit Recurring Expense" : "Add Recurring Expense")}
        </AppText>
        <View className="w-8" />
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
                <AppText variant="label" className="mb-1.5 mt-1">Paid Date</AppText>
                <TouchableOpacity
                  className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                  onPress={() => setShowPaidPicker(true)}
                  accessibilityLabel="Select paid date"
                >
                  <AppText variant="body-medium" className="text-white text-base">
                    {dayjs(value).format("MMM D, YYYY")}
                  </AppText>
                  <Feather name="calendar" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
                {showPaidPicker && (
                  <DateTimePicker
                    value={dayjs(value).toDate()}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                      setShowPaidPicker(false);
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
        {!isRegular && (
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
            render={({ field: { value, onChange, onBlur } }) => (
              <AppTextInput
                label="Due Day (1–31) *"
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
              if (isVariableWatched) return true;
              if (v === "" || v === undefined) return true;
              const n = parseFloat(v);
              return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
            },
          }}
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              autoFocus
              label={isVariableWatched ? "This Month's Amount" : "Amount"}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          )}
        />

        {/* Category */}
        <AppText variant="label" className="mb-1.5 mt-1">Category</AppText>
        <Controller
          control={control}
          name="category"
          render={({ field: { value } }) => (
            <TouchableOpacity
              className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
              onPress={() => categorySheetRef.current?.present()}
            >
              <AppText variant="body-medium" className="text-white text-base">{value}</AppText>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        />

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
                />
              )}
            />

            <Controller
              control={control}
              name="isVariable"
              render={({ field: { value, onChange } }) => (
                <TouchableOpacity
                  className="flex-row items-center gap-3 bg-surface border border-border rounded-xl px-3.5 py-3 mb-1 mt-1"
                  onPress={() => onChange(!value)}
                  accessibilityLabel="Toggle variable expense"
                >
                  <View
                    className="w-5 h-5 rounded border-2 items-center justify-center"
                    style={{
                      borderColor: value ? colors.primary : "rgba(255,255,255,0.25)",
                      backgroundColor: value ? colors.primary : "transparent",
                    }}
                  >
                    {value && <Feather name="check" size={12} color="#FFFFFF" />}
                  </View>
                  <View className="flex-1">
                    <AppText variant="body-medium" className="text-white text-sm">Variable amount</AppText>
                    <AppText variant="caption" className="text-white/40 text-xs">Amount changes each month</AppText>
                  </View>
                </TouchableOpacity>
              )}
            />

            <Controller
              control={control}
              name="hasEndDate"
              render={({ field: { value, onChange } }) => (
                <TouchableOpacity
                  className="flex-row items-center gap-3 bg-surface border border-border rounded-xl px-3.5 py-3 mb-1 mt-1"
                  onPress={() => onChange(!value)}
                  accessibilityLabel="Toggle end month"
                >
                  <View
                    className="w-5 h-5 rounded border-2 items-center justify-center"
                    style={{
                      borderColor: value ? colors.primary : "rgba(255,255,255,0.25)",
                      backgroundColor: value ? colors.primary : "transparent",
                    }}
                  >
                    {value && <Feather name="check" size={12} color="#FFFFFF" />}
                  </View>
                  <View className="flex-1">
                    <AppText variant="body-medium" className="text-white text-sm">Set an end month</AppText>
                    <AppText variant="caption" className="text-white/40 text-xs">Stops recurring after this month</AppText>
                  </View>
                </TouchableOpacity>
              )}
            />
            {hasEndDateWatched && (
              <Controller
                control={control}
                name="endDate"
                render={({ field: { value, onChange } }) => (
                  <>
                    <AppText variant="label" className="mb-1.5 mt-1">Ends</AppText>
                    <TouchableOpacity
                      className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                      onPress={() => setShowEndPicker(true)}
                      accessibilityLabel="Select end month"
                    >
                      <AppText variant="body-medium" className="text-white text-base">
                        {dayjs(value).format("MMM YYYY")}
                      </AppText>
                      <Feather name="calendar" size={16} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                    {showEndPicker && (
                      <DateTimePicker
                        value={dayjs(value).toDate()}
                        mode="date"
                        minimumDate={new Date(now.getFullYear(), now.getMonth(), 1)}
                        onChange={(event, date) => {
                          setShowEndPicker(false);
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

            <Controller
              control={control}
              name="reminderDaysBefore"
              rules={{
                validate: (v) => {
                  if (!v || v.trim() === '') return true;
                  const n = parseInt(v, 10);
                  return (!isNaN(n) && n >= 1 && n <= 14) || 'Must be 1–14';
                },
              }}
              render={({ field: { value, onChange, onBlur } }) => (
                <AppTextInput
                  label="Remind me (days before)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="1"
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
            />
            <AppText variant="caption" className="text-white/40 text-xs px-1 mb-3">
              Leave blank for default (1 day before due)
            </AppText>
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
          disabled={!isValid}
          className="mt-4"
        />

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
    </SafeAreaView>
  );
}
