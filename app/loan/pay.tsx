import React, { useRef } from "react";
import useBoolean from "ahooks/es/useBoolean";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Feather } from "@expo/vector-icons";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppButton } from "@/components/ui/AppButton";
import { LoadingState } from "@/components/ui/LoadingState";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import { formatAmount } from "@/utils/dateHelpers";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import type { Loan } from "@/types";

interface FormValues {
  amount: string;
  accountId: string;
  paidAt: string;
}

function RecordPaymentForm({ loan }: { loan: Loan }) {
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const [isDatePickerOpen, datePicker] = useBoolean();
  const loans = useLoans();
  const { accounts } = useAccounts();
  const balance = loans.summaries[loan.id]?.balance ?? 0;
  const depositAccounts = accounts.filter((a) => a.type !== "credit");
  const isLiveDeposit = depositAccounts.some((a) => a.id === loan.accountId);
  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { isValid, isSubmitting },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      amount: "",
      accountId: isLiveDeposit ? loan.accountId : CASH_ACCOUNT_ID,
      paidAt: dayjs().startOf("day").toISOString(),
    },
  });

  function validateAmount(value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0.01) {
      return "Enter at least 0.01";
    }
    const next = summarizeLoan({
      loan,
      payments: [...loans.paymentsOf(loan.id), { amount: parsed, createdAt: getValues("paidAt") }],
      today: dayjs().format("YYYY-MM-DD"),
    });
    if (next.isValid) {
      return true;
    }
    if (parsed > balance) {
      return `More than the ${formatAmount(balance)} still owed`;
    }
    return "This payment would overpay a later one. Lower it or change the date.";
  }

  const onSubmit = handleSubmit(async ({ amount, accountId, paidAt }) => {
    try {
      await loans.recordPayment({
        loanId: loan.id,
        accountId,
        amount: parseFloat(amount),
        paidAt,
      });
      router.back();
    } catch (e) {
      console.error("Record payment failed", e);
      Alert.alert("Payment failed", "Something went wrong. Please try again.");
    }
  });

  const minimumDate = dayjs(loan.lentAt).startOf("day").toDate();

  return (
    <>
      <ScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="amount"
          rules={{ validate: validateAmount }}
          render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
            <AppTextInput
              autoFocus
              label="Amount (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              error={error?.message}
            />
          )}
        />
        <AppText variant="meta" className="mb-3">{`Max ${formatAmount(balance)}`}</AppText>

        <AppLabel>Paid into</AppLabel>
        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => {
            const accountName = accounts.find((a) => a.id === value)?.name ?? "Choose account";
            return (
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-3"
                onPress={() => accountSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={`Paid into, ${accountName}`}
              >
                <AppText variant="body-medium" className="text-white text-base">{accountName}</AppText>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />

        <Controller
          control={control}
          name="paidAt"
          render={({ field: { value, onChange } }) => (
            <>
              <AppLabel>Date</AppLabel>
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                onPress={datePicker.setTrue}
                accessibilityRole="button"
                accessibilityLabel={`Payment date, ${dayjs(value).format("MMM D, YYYY")}`}
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
                  minimumDate={minimumDate}
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    datePicker.setFalse();
                    if (event.type === "set" && date) {
                      onChange(dayjs(date).startOf("day").toISOString());
                      trigger("amount");
                    }
                  }}
                />
              )}
            </>
          )}
        />

        <AppButton
          label="Record payment"
          onPress={onSubmit}
          disabled={!isValid}
          loading={isSubmitting}
          className="mt-4"
        />

        <View className="h-8" />
      </ScrollView>

      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet
            ref={accountSheetRef}
            title="Paid into"
            options={depositAccounts}
            value={value}
            onChange={onChange}
          />
        )}
      />
    </>
  );
}

export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loans = useLoans();
  const loan = loans.loans.find((l) => l.id === id);

  if (loans.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">This loan no longer exists.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <AppText variant="title" numberOfLines={1}>Record payment</AppText>
          <AppText variant="meta" numberOfLines={1}>{loan.borrower}</AppText>
        </View>
        <View className="w-11" />
      </View>

      <RecordPaymentForm loan={loan} />
    </SafeAreaView>
  );
}
