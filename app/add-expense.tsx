import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Feather } from "@expo/vector-icons";
import { useExpenses } from "../context/ExpenseContext";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import { AppText } from "../components/ui/AppText";
import { AppTextInput } from "../components/ui/AppTextInput";
import { colors } from "../constants/theme";
import type { Recurrence, ExpenseFormValues } from "../types";

const RECURRENCE_OPTIONS: { label: string; value: Recurrence }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
  { label: "One-off", value: "one-off" },
];

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addExpense, updateExpense, expenses } = useExpenses();
  const editingExpense = id ? expenses.find((e) => e.id === id) ?? null : null;
  const isEditing = editingExpense !== null;
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      name: editingExpense?.name ?? "",
      amount: editingExpense?.amount?.toString() ?? "",
      category: editingExpense?.category ?? "Other",
      dueDay: editingExpense?.dueDay?.toString() ?? "1",
      recurrence: editingExpense?.recurrence ?? "monthly",
      notes: editingExpense?.notes ?? "",
    },
  });

  React.useEffect(() => {
    if (editingExpense) {
      reset({
        name: editingExpense.name,
        amount: editingExpense.amount.toString(),
        category: editingExpense.category,
        dueDay: editingExpense.dueDay.toString(),
        recurrence: editingExpense.recurrence,
        notes: editingExpense.notes ?? "",
      });
    }
  }, [editingExpense?.id]);

  const onSubmit = handleSubmit(async (data) => {
    const fields = {
      name: data.name.trim(),
      amount: parseFloat(data.amount),
      category: data.category,
      dueDay: parseInt(data.dueDay, 10),
      recurrence: data.recurrence,
      status: editingExpense?.status ?? "unpaid",
      notes: data.notes.trim() || undefined,
    };

    try {
      if (isEditing && id) {
        await updateExpense(id, fields);
      } else {
        await addExpense(fields);
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
        <Text className="flex-1 text-center text-white text-[22px]" style={{ fontFamily: "Oswald_Bold" }}>
          {isEditing ? "Edit Expense" : "Add Expense"}
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Controller
          control={control}
          name="name"
          rules={{ required: true, validate: (v) => v.trim().length >= 1 || "Required" }}
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Name *"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Netflix"
              returnKeyType="next"
            />
          )}
        />

        {/* Amount */}
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
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Amount *"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
              returnKeyType="next"
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
              className="bg-surface border border-border rounded-xl px-3.5 py-3 flex-row items-center justify-between mb-1"
              onPress={() => categorySheetRef.current?.present()}
            >
              <AppText variant="body-medium" className="text-white text-base">{value}</AppText>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        />

        {/* Due Day */}
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
              returnKeyType="next"
              maxLength={2}
            />
          )}
        />

        {/* Recurrence */}
        <AppText variant="label" className="mb-1.5 mt-1">Recurrence</AppText>
        <Controller
          control={control}
          name="recurrence"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row bg-surface rounded-[10px] border border-border mb-1 overflow-hidden">
              {RECURRENCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  className={`flex-1 py-4 items-center ${
                    value === opt.value ? "bg-primary" : ""
                  }`}
                  onPress={() => onChange(opt.value)}
                >
                  <Text
                    className={`text-xs ${
                      value === opt.value
                        ? "text-white font-quicksand-bold"
                        : "text-white/50 font-quicksand-medium"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        {/* Notes */}
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Notes"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional note…"
              multiline
              maxLength={200}
            />
          )}
        />

        {/* Save */}
        <TouchableOpacity
          className={`bg-primary rounded-xl py-3.5 items-center mt-4 ${!isValid ? "opacity-40" : ""}`}
          onPress={onSubmit}
          disabled={!isValid}
        >
          <Text className="text-white text-[15px] font-quicksand-bold tracking-wide">
            {isEditing ? "Save Changes" : "Save Expense"}
          </Text>
        </TouchableOpacity>

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
