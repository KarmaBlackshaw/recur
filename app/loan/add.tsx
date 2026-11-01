import React, { useEffect, useMemo, useRef } from "react";
import { maxBy, orderBy, uniqBy } from "@/utils/collections";
import { View, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { TransferInButton } from "@/components/accounts/TransferInButton";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppCheckRow } from "@/components/ui/AppCheckRow";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppCombobox } from "@/components/ui/AppCombobox";
import { CASH_ACCOUNT_ID, DELETED_ACCOUNT } from "@/constants/accounts";
import { sanitizeAmount } from "@/utils/amountInput";
import { formatAmount } from "@/utils/dateHelpers";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import { toLoanInterest } from "@/utils/loans/toLoanInterest";
import { fromLoanInterest } from "@/utils/loans/fromLoanInterest";
import { loanOutChanges } from "@/utils/loans/loanOutChanges";
import { isLoanOutOf } from "@/utils/loans/isLoanOutOf";
import { deleteLoanMessage } from "@/utils/loans/deleteLoanMessage";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import {
  LOAN_INTEREST_TYPE_LABEL,
  type Loan,
  type LoanInput,
  type TLoanInterestType,
} from "@/types";

interface LoanFormValues {
  borrower: string;
  amount: string;
  isLentBeforeRecur: boolean;
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

function validateBorrower(value: string) {
  return value.trim().length > 0 || "Enter who you lent to";
}

function validateAmount(value: string) {
  const n = parseFloat(value);
  return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
}

function validateInterestValue(value: string, { interestType }: Pick<LoanFormValues, "interestType">) {
  const n = parseFloat(value);
  if (interestType === "none") {
    return true;
  }
  if (interestType === "fixed") {
    return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
  }
  return (!isNaN(n) && n > 0) || "Enter a rate above 0";
}

// Names the first field that still blocks saving, since errors only show once a field was touched.
function saveHintOf(values: LoanFormValues) {
  if (validateBorrower(values.borrower) !== true) {
    return "Enter a borrower to save";
  }
  if (validateAmount(values.amount) !== true) {
    return "Enter an amount to save";
  }
  if (validateInterestValue(values.interestValue, values) !== true) {
    return values.interestType === "fixed" ? "Enter the interest amount to save" : "Enter a rate to save";
  }
  return undefined;
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
    accountId: values.isLentBeforeRecur ? null : values.accountId,
    lentAt: values.lentAt,
    interest: toLoanInterest(values.interestType, value),
    note: values.notes.trim() || null,
  };
}

export default function AddLoanScreen() {
  const { id, borrower: borrowerParam } = useLocalSearchParams<{ id?: string; borrower?: string }>();
  const loans = useLoans();
  const accounts = useAccounts();
  const editing = id ? loans.loans.find((l) => l.id === id) : undefined;
  const isEditing = editing != null;
  // "New loan" from a borrower's screen arrives with their name filled in.
  const prefilledBorrower = id ? "" : (borrowerParam?.trim() ?? "");
  const isLoading = loans.isLoading || accounts.isLoading;
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const amountRef = useRef<TextInput>(null);

  const depositAccounts = accounts.activeAccounts.filter((a) => a.type !== "credit");

  function toFormValues(loan?: Loan): LoanFormValues {
    const lastAccountId = maxBy(loans.loans, "lentAt")?.accountId;
    const defaultAccountId = depositAccounts.find((a) => a.id === lastAccountId)?.id ?? CASH_ACCOUNT_ID;
    if (loan) {
      const interest = fromLoanInterest(loan.interest);
      return {
        borrower: loan.borrower,
        amount: loan.principal.toString(),
        isLentBeforeRecur: loan.accountId == null,
        accountId: loan.accountId ?? defaultAccountId,
        lentAt: loan.lentAt,
        interestType: interest.type,
        interestValue: interest.value?.toString() ?? "",
        notes: loan.note ?? "",
      };
    }
    return {
      borrower: prefilledBorrower,
      amount: "",
      isLentBeforeRecur: false,
      accountId: defaultAccountId,
      lentAt: dayjs().startOf("day").toISOString(),
      interestType: "none",
      interestValue: "",
      notes: "",
    };
  }

  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<LoanFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(editing),
  });
  const { allowLeave } = useDiscardGuard(isDirty);

  useEffect(() => {
    if (!isLoading) {
      reset(toFormValues(editing));
    }
  }, [isLoading, editing?.id]);

  function revalidateAmount() {
    const amount = getValues("amount");
    if (amount) {
      trigger("amount");
    }
  }

  useEffect(() => {
    revalidateAmount();
  }, [accounts.transactions]);

  function amountOverdraft(amount: string) {
    const { isLentBeforeRecur, accountId } = getValues();
    return accounts.overdraftError(
      loanOutChanges({
        accountId: isLentBeforeRecur ? null : accountId,
        principal: parseFloat(amount),
      }),
      isEditing && id ? isLoanOutOf(id) : undefined
    );
  }

  const values = watch();
  const candidate = toLoanInput(values);
  const savedAccountName = accounts.accounts.find((a) => a.id === editing?.accountId)?.name;
  const refundNote =
    editing && values.isLentBeforeRecur && savedAccountName
      ? `${formatAmount(editing.principal)} goes back to ${savedAccountName}`
      : undefined;

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
      allowLeave();
      router.back();
    } catch (error) {
      console.error(error);
      alertFailure("Save failed", error);
    }
  });

  function handleDelete() {
    if (!id || !editing) {
      return;
    }
    const message = deleteLoanMessage(editing, loans.paymentsOf(editing.id).length, savedAccountName);
    Alert.alert("Delete this loan?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await loans.deleteLoan(id);
            allowLeave();
            router.dismissTo("/loans");
          } catch (error) {
            console.error(error);
            alertFailure("Delete failed", error);
          }
        },
      },
    ]);
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
    setValue("borrower", name, { shouldValidate: true, shouldDirty: true });
    focusAmount();
  }

  const saveHint = isValid ? undefined : saveHintOf(values);
  const isSaveDisabled = !isValid || !isCandidateValid || isLoading;

  const interestHelp = INTEREST_HELP[values.interestType];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={isEditing ? "Edit loan" : "New loan"}
        action={{
          label: "Save",
          onPress: onSubmit,
          isDisabled: isSaveDisabled,
          isLoading: isSubmitting,
          accessibilityHint: saveHint,
        }}
      />

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
            validate: validateBorrower,
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppCombobox
              autoFocus={!isEditing && prefilledBorrower === ""}
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
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
            />
          )}
        />

        <Controller
          control={control}
          name="amount"
          rules={{
            required: true,
            validate: (v) => {
              const valid = validateAmount(v);
              if (valid !== true) {
                return valid;
              }
              return amountOverdraft(v)?.message ?? true;
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <AppTextInput
                ref={amountRef}
                autoFocus={!isEditing && prefilledBorrower !== ""}
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
          name="isLentBeforeRecur"
          render={({ field: { value, onChange } }) => (
            <AppCheckRow
              label="Existing loan"
              description="No account is debited"
              checked={value}
              onToggle={(checked) => {
                onChange(checked);
                revalidateAmount();
              }}
            />
          )}
        />
        {refundNote && (
          <AppText variant="meta" className="mb-1">{refundNote}</AppText>
        )}

        {!values.isLentBeforeRecur && (
          <Controller
            control={control}
            name="accountId"
            render={({ field: { value } }) => (
              <AppSelectField
                label="From account"
                value={accounts.accounts.find((a) => a.id === value)?.name ?? DELETED_ACCOUNT}
                onPress={() => accountSheetRef.current?.present()}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="lentAt"
          render={({ field: { value, onChange } }) => (
            <AppDateField label="Lent on" value={value} onChange={onChange} maximumDate={new Date()} />
          )}
        />
        {values.isLentBeforeRecur && (
          <AppText variant="meta" className="mb-1">Use the day you lent it. Interest counts from then.</AppText>
        )}

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
            rules={{ validate: validateInterestValue }}
            render={({ field: { value, onChange, onBlur }, fieldState }) =>
              values.interestType === "fixed" ? (
                <AppTextInput
                  label="Interest amount (₱)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  error={fieldState.isTouched ? fieldState.error?.message : undefined}
                />
              ) : (
                <AppTextInput
                  label="Rate (%)"
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={(t) => onChange(sanitizeAmount(t))}
                  onBlur={onBlur}
                  placeholder="0"
                  error={fieldState.isTouched ? fieldState.error?.message : undefined}
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
          disabled={isSaveDisabled}
          loading={isSubmitting}
          accessibilityHint={saveHint}
          className="mt-4"
        />
        {saveHint && (
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
            onChange={(accountId) => {
              onChange(accountId);
              revalidateAmount();
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}
