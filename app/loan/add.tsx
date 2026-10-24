import React, { useEffect, useMemo, useRef } from "react";
import useBoolean from "ahooks/es/useBoolean";
import maxBy from "lodash/maxBy";
import orderBy from "lodash/orderBy";
import uniqBy from "lodash/uniqBy";
import { View, TouchableOpacity, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppCombobox } from "@/components/ui/AppCombobox";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import { sanitizeAmount } from "@/utils/amountInput";
import { formatAmount } from "@/utils/dateHelpers";
import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import { toLoanInterest } from "@/utils/loans/toLoanInterest";
import { fromLoanInterest } from "@/utils/loans/fromLoanInterest";
import {
  LOAN_INTEREST_TYPE_LABEL,
  type Loan,
  type LoanInput,
  type TLoanInterestType,
} from "@/types";

interface LoanFormValues {
  borrower: string;
  amount: string;
  accountId: string;
  lentAt: string;
  interestType: TLoanInterestType;
  interestValue: string;
  notes: string;
}

const INTEREST_TYPES: TLoanInterestType[] = ["none", "fixed", "percent_once", "monthly_principal", "monthly_balance"];

const INTEREST_OPTIONS = INTEREST_TYPES.map((value) => ({
  label: LOAN_INTEREST_TYPE_LABEL[value],
  value,
}));

const INTEREST_HELP: Partial<Record<TLoanInterestType, string>> = {
  monthly_principal: "Charged each month on the amount you lent.",
  monthly_balance: "Charged each month on what's still owed, so unpaid interest adds up.",
};

const INVALID_EDIT_MESSAGE =
  "Payments already recorded are more than this loan now totals, or one is dated before the lent date. Raise the amount or move the date.";

function isMonthly(type: TLoanInterestType) {
  return type === "monthly_principal" || type === "monthly_balance";
}

function toLoanInput(values: LoanFormValues): LoanInput | undefined {
  const principal = parseFloat(values.amount);
  const parsedValue = parseFloat(values.interestValue);
  const value = isNaN(parsedValue) ? null : parsedValue;
  if (isNaN(principal) || (values.interestType !== "none" && value == null)) {
    return undefined;
  }
  return {
    borrower: values.borrower.trim(),
    principal,
    accountId: values.accountId,
    lentAt: values.lentAt,
    interest: toLoanInterest(values.interestType, value),
    note: values.notes.trim() || null,
  };
}

export default function AddLoanScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const loans = useLoans();
  const accounts = useAccounts();
  const editing = id ? loans.loans.find((l) => l.id === id) : undefined;
  const isEditing = editing != null;
  const isLoading = loans.isLoading || accounts.isLoading;
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const amountRef = useRef<TextInput>(null);
  const [isDatePickerOpen, datePicker] = useBoolean();

  const depositAccounts = accounts.accounts.filter((a) => a.type !== "credit");

  function toFormValues(loan?: Loan): LoanFormValues {
    if (loan) {
      const interest = fromLoanInterest(loan.interest);
      return {
        borrower: loan.borrower,
        amount: loan.principal.toString(),
        accountId: loan.accountId,
        lentAt: loan.lentAt,
        interestType: interest.type,
        interestValue: interest.value?.toString() ?? "",
        notes: loan.note ?? "",
      };
    }
    const lastAccountId = maxBy(loans.loans, "lentAt")?.accountId;
    return {
      borrower: "",
      amount: "",
      accountId: depositAccounts.find((a) => a.id === lastAccountId)?.id ?? CASH_ACCOUNT_ID,
      lentAt: dayjs().startOf("day").toISOString(),
      interestType: "none",
      interestValue: "",
      notes: "",
    };
  }

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    trigger,
    watch,
    formState: { isValid, isSubmitting, errors },
  } = useForm<LoanFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(editing),
  });

  useEffect(() => {
    if (!isLoading) {
      reset(toFormValues(editing));
    }
  }, [isLoading, editing?.id]);

  const values = watch();
  const candidate = toLoanInput(values);

  const borrowerNames = useMemo(
    () =>
      uniqBy(
        orderBy(loans.loans, "lentAt", "desc").map((l) => l.borrower.trim()),
        (n) => n.toLowerCase()
      ),
    [loans.loans]
  );

  function previewOf(input: LoanInput) {
    if (isMonthly(input.interest.type)) {
      const firstCharge = summarizeLoan({
        loan: input,
        payments: [],
        today: dayjs(input.lentAt).add(1, "month").format("YYYY-MM-DD"),
      }).charges[0]?.amount;
      return firstCharge == null ? undefined : `+${formatAmount(firstCharge)} first month`;
    }
    const { balance } = summarizeLoan({ loan: input, payments: [], today: dayjs(input.lentAt).format("YYYY-MM-DD") });
    return `${input.borrower || "They"} will owe ${formatAmount(balance)}`;
  }

  const preview = candidate ? previewOf(candidate) : undefined;

  const isCandidateValid =
    editing == null ||
    candidate == null ||
    summarizeLoan({ loan: candidate, payments: loans.paymentsOf(editing.id), today: dayjs().format("YYYY-MM-DD") }).isValid;

  const onSubmit = handleSubmit(async (data) => {
    const input = toLoanInput(data);
    if (!input) {
      return;
    }
    try {
      if (isEditing && id) {
        await loans.updateLoan(id, input);
      } else {
        await loans.addLoan(input);
      }
      reset();
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  });

  const paymentCount = editing ? loans.paymentsOf(editing.id).length : 0;
  const deleteMessage =
    paymentCount > 0
      ? `Its ${paymentCount === 1 ? "1 payment is" : `${paymentCount} payments are`} removed and account balances go back.`
      : "Account balances go back.";

  function handleDelete() {
    if (!id) {
      return;
    }
    Alert.alert("Delete this loan?", deleteMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await loans.deleteLoan(id);
            router.dismissTo("/loans");
          } catch (error) {
            console.error(error);
            Alert.alert("Delete failed", "Something went wrong. Please try again.");
          }
        },
      },
    ]);
  }

  function handleLentDateChange(event: DateTimePickerEvent, date?: Date) {
    datePicker.setFalse();
    if (event.type === "set" && date) {
      setValue("lentAt", dayjs(date).startOf("day").toISOString(), { shouldValidate: true, shouldDirty: true });
    }
  }

  function handleInterestTypeChange(type: TLoanInterestType) {
    setValue("interestType", type, { shouldValidate: true, shouldDirty: true });
    if (type === "none") {
      setValue("interestValue", "");
    }
    trigger("interestValue");
  }

  function focusAmount() {
    amountRef.current?.focus();
  }

  function pickBorrower(name: string) {
    setValue("borrower", name, { shouldValidate: true });
    focusAmount();
  }

  const saveHint = Object.keys(errors).length
    ? "Fix the highlighted fields to save"
    : "Fill in the required fields to save";

  const interestHelp = INTEREST_HELP[values.interestType];

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
          {isEditing ? "Edit loan" : "New loan"}
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
          name="borrower"
          rules={{
            required: "Enter who you lent to",
            validate: (v) => v.trim().length > 0 || "Enter who you lent to",
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppCombobox
              autoFocus={!isEditing}
              label="Borrower"
              items={borrowerNames}
              onPick={pickBorrower}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Ana"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={focusAmount}
              error={fieldState.error?.message}
            />
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
              ref={amountRef}
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

        <AppLabel>From account</AppLabel>
        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => {
            const accountName = accounts.accounts.find((a) => a.id === value)?.name ?? "Deleted account";
            return (
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                onPress={() => accountSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={`From account, ${accountName}`}
              >
                <AppText variant="body-medium" className="text-white text-base">{accountName}</AppText>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />

        <Controller
          control={control}
          name="lentAt"
          render={({ field: { value } }) => (
            <>
              <AppLabel>Lent on</AppLabel>
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
                onPress={datePicker.setTrue}
                accessibilityRole="button"
                accessibilityLabel={`Lent on, ${dayjs(value).format("MMM D, YYYY")}`}
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
                  onChange={handleLentDateChange}
                />
              )}
            </>
          )}
        />

        <Controller
          control={control}
          name="interestType"
          render={({ field: { value } }) => (
            <AppRadioGroup
              label="Interest"
              options={INTEREST_OPTIONS}
              value={value}
              onChange={handleInterestTypeChange}
            />
          )}
        />
        {interestHelp && (
          <AppText variant="meta" className="mb-1">{interestHelp}</AppText>
        )}

        {values.interestType !== "none" && (
          <Controller
            control={control}
            name="interestValue"
            rules={{
              validate: (v) => {
                const type = getValues("interestType");
                const n = parseFloat(v);
                if (type === "none") {
                  return true;
                }
                if (type === "fixed") {
                  return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
                }
                return (!isNaN(n) && n > 0) || "Enter a rate above 0";
              },
            }}
            render={({ field: { value, onChange, onBlur }, fieldState }) =>
              values.interestType === "fixed" ? (
                <AppTextInput
                  label="Interest amount (₱)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  error={fieldState.error?.message}
                />
              ) : (
                <AppTextInput
                  label="Rate (%)"
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={(t) => onChange(sanitizeAmount(t))}
                  onBlur={onBlur}
                  placeholder="0"
                  error={fieldState.error?.message}
                />
              )
            }
          />
        )}

        {preview && (
          <AppText variant="meta" className="mb-1">{preview}</AppText>
        )}

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Notes"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. For tuition"
              multiline
              maxLength={200}
            />
          )}
        />

        {!isCandidateValid && (
          <AppText variant="meta" className="text-overdue mt-2">{INVALID_EDIT_MESSAGE}</AppText>
        )}

        <AppButton
          label={isEditing ? "Save changes" : "Save loan"}
          onPress={onSubmit}
          disabled={!isValid || !isCandidateValid || isLoading}
          loading={isSubmitting}
          accessibilityHint={isValid ? undefined : saveHint}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">{saveHint}</AppText>
        )}
        {isEditing && (
          <AppButton
            label="Delete loan"
            variant="destructive"
            onPress={handleDelete}
            className="mt-3"
          />
        )}

        <View className="h-8" />
      </AppFormScrollView>

      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet
            ref={accountSheetRef}
            title="From account"
            options={depositAccounts}
            value={value}
            onChange={onChange}
          />
        )}
      />
    </SafeAreaView>
  );
}
