import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import { useExpenses } from "../context/ExpenseContext";
import { CategoryPicker } from "../components/CategoryPicker";
import { colors } from "../constants/theme";
import type { Recurrence, ExpenseFormValues } from "../types";

const RECURRENCE_OPTIONS: { label: string; value: Recurrence }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
  { label: "One-off", value: "one-off" },
];

export default function AddExpenseScreen() {
  const { addExpense } = useExpenses();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      amount: "",
      category: "Other",
      dueDay: "1",
      recurrence: "monthly",
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const amountNum = parseFloat(data.amount);
    await addExpense({
      name: data.name.trim(),
      amount: amountNum,
      category: data.category,
      dueDay: parseInt(data.dueDay, 10),
      recurrence: data.recurrence,
      status: "unpaid",
      notes: data.notes.trim() || undefined,
    });
    reset();
    router.back();
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
          <Ionicons name="chevron-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-white text-[22px] font-caveat-bold">
          Add Expense
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-1">
          Name *
        </Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: true, validate: (v) => v.trim().length >= 1 || "Required" }}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="bg-surface border border-border rounded-[10px] px-3.5 py-3 text-white font-quicksand text-[15px] mb-1"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Netflix"
              placeholderTextColor="rgba(255,255,255,0.3)"
              returnKeyType="next"
            />
          )}
        />

        {/* Amount */}
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-1">
          Amount *
        </Text>
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
            <TextInput
              className="bg-surface border border-border rounded-[10px] px-3.5 py-3 text-white font-quicksand text-[15px] mb-1"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          )}
        />

        {/* Category */}
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-1">
          Category
        </Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <CategoryPicker value={value} onChange={onChange} />
          )}
        />

        {/* Due Day */}
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-3">
          Due Day (1–31) *
        </Text>
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
            <TextInput
              className="bg-surface border border-border rounded-[10px] px-3.5 py-3 text-white font-quicksand text-[15px] mb-1"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              returnKeyType="next"
              maxLength={2}
            />
          )}
        />

        {/* Recurrence */}
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-1">
          Recurrence
        </Text>
        <Controller
          control={control}
          name="recurrence"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row bg-surface rounded-[10px] border border-border mb-1 overflow-hidden">
              {RECURRENCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  className={`flex-1 py-2.5 items-center ${
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
        <Text className="text-white/60 text-[11px] font-quicksand-bold uppercase tracking-widest mb-1.5 mt-1">
          Notes
        </Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              className="bg-surface border border-border rounded-[10px] px-3.5 py-3 text-white font-quicksand text-[15px] mb-1 h-[72px]"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional note…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              maxLength={200}
              textAlignVertical="top"
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
            Save Expense
          </Text>
        </TouchableOpacity>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
