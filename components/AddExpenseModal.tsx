import React, { useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Controller, useForm } from "react-hook-form";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useExpenses } from "../context/ExpenseContext";
import { CategoryPicker } from "./CategoryPicker";
import { colors } from "../constants/theme";
import type { Recurrence } from "../types";

export interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDate: Date;
  recurrence: Recurrence;
  notes: string;
}

const RECURRENCE_OPTIONS: { label: string; value: Recurrence }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
  { label: "One-off", value: "one-off" },
];

interface Props {
  bottomSheetRef: React.RefObject<BottomSheetModal>;
}

export function AddExpenseModal({ bottomSheetRef }: Props) {
  const { addExpense } = useExpenses();
  const snapPoints = useMemo(() => ["75%", "92%"], []);

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
      dueDate: new Date(),
      recurrence: "monthly",
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum < 0.01) {
      Alert.alert("Invalid amount");
      return;
    }
    await addExpense({
      name: data.name.trim(),
      amount: amountNum,
      category: data.category,
      dueDate: format(data.dueDate, "yyyy-MM-dd"),
      recurrence: data.recurrence,
      status: "unpaid",
      notes: data.notes.trim() || undefined,
    });
    reset();
    bottomSheetRef.current?.dismiss();
  });

  function handleCancel() {
    reset();
    bottomSheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Expense</Text>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: true, minLength: 1 }}
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
          rules={{ required: true }}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
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

        {/* Due Date */}
        <Text style={[styles.label, { marginTop: 12 }]}>Due Date</Text>
        <Controller
          control={control}
          name="dueDate"
          render={({ field: { value, onChange } }) => (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={value}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, date) => date && onChange(date)}
                themeVariant="dark"
                accentColor={colors.secondary}
              />
            </View>
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "#0D1829",
  },
  handle: {
    backgroundColor: "rgba(255,255,255,0.25)",
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Caveat_700Bold",
  },
  cancelBtn: {
    color: colors.secondary,
    fontSize: 14,
    fontFamily: "Quicksand_500Medium",
  },
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
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  currencyPrefix: {
    color: colors.secondary,
    fontSize: 18,
    fontFamily: "Caveat_700Bold",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    marginBottom: 0,
  },
  datePickerWrap: {
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
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontFamily: "Quicksand_700Bold",
  },
  notesInput: {
    height: 72,
    marginBottom: 4,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Quicksand_700Bold",
    letterSpacing: 0.5,
  },
});
