import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
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
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: true, validate: (v) => v.trim().length >= 1 || "Required" }}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
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
        <Text style={styles.label}>Amount *</Text>
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
              style={styles.input}
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
        <Text style={styles.label}>Category</Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <CategoryPicker value={value} onChange={onChange} />
          )}
        />

        {/* Due Day */}
        <Text style={[styles.label, { marginTop: 12 }]}>Due Day (1–31) *</Text>
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
              style={styles.input}
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
        <Text style={styles.label}>Recurrence</Text>
        <Controller
          control={control}
          name="recurrence"
          render={({ field: { value, onChange } }) => (
            <View style={styles.segmented}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segment,
                    value === opt.value && styles.segmentActive,
                  ]}
                  onPress={() => onChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      value === opt.value && styles.segmentTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[styles.input, styles.notesInput]}
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
          style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
          onPress={onSubmit}
          disabled={!isValid}
        >
          <Text style={styles.saveBtnText}>Save Expense</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Caveat_700Bold",
  },
  headerSpacer: { width: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontFamily: "Quicksand_400Regular",
    fontSize: 15,
    marginBottom: 4,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
    overflow: "hidden",
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
  },
  segmentTextActive: { color: "#FFFFFF", fontFamily: "Quicksand_700Bold" },
  notesInput: { height: 72, marginBottom: 4 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Quicksand_700Bold",
    letterSpacing: 0.5,
  },
});
