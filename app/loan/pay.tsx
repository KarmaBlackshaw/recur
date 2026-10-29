import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { orderBy } from "@/utils/collections";
import Feather from "@expo/vector-icons/Feather";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppText } from "@/components/ui/AppText";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { LoadingState } from "@/components/ui/LoadingState";
import { TransferInButton } from "@/components/accounts/TransferInButton";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import { formatAmount } from "@/utils/dateHelpers";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import type { AccountTransaction, Loan } from "@/types";

interface FormValues {
  loanId: string;
  amount: string;
  accountId: string;
  paidAt: string;
}

type TPayment = Pick<AccountTransaction, "amount" | "createdAt">;

// The most a payment dated `paidAt` can be without overpaying. Paying earlier also trims the monthly interest
// charged after that date, so a backdated payment can settle the loan for less than today's balance.
function maxPaymentOn(loan: Loan, others: TPayment[], paidAt: string, today: string) {
  const fits = (cents: number) =>
    summarizeLoan({ loan, payments: [...others, { amount: cents / 100, createdAt: paidAt }], today }).isValid;
  let low = 0;
  let high = Math.max(0, Math.round(summarizeLoan({ loan, payments: others, today }).balance * 100));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low / 100;
}

interface FormProps {
  // The loans this payment can go to: one, or each active loan of a borrower (oldest first).
  choices: Loan[];
  // Set when editing an existing payment.
  payment?: AccountTransaction;
}

function PaymentForm({ choices, payment }: FormProps) {
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const loans = useLoans();
  const { accounts, activeAccounts, transactions, overdraftError } = useAccounts();
  const depositAccounts = activeAccounts.filter((a) => a.type !== "credit");
  const isEditing = payment != null;
  const today = dayjs().format("YYYY-MM-DD");

  function loanOf(loanId: string) {
    return choices.find(({ id }) => id === loanId) ?? choices[0];
  }

  function suggestedAccountOf(loan: Loan) {
    return depositAccounts.some((a) => a.id === loan.accountId) ? loan.accountId : CASH_ACCOUNT_ID;
  }

  // The loan's other payments. The one being edited is left out so it doesn't count against itself.
  function otherPaymentsOf(loanId: string): TPayment[] {
    return loans.paymentsOf(loanId).filter(({ id }) => id !== payment?.id);
  }

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    watch,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: payment
      ? {
          loanId: choices[0].id,
          amount: Math.abs(payment.amount).toFixed(2),
          accountId: payment.accountId,
          paidAt: payment.createdAt,
        }
      : {
          loanId: choices[0].id,
          amount: "",
          accountId: suggestedAccountOf(choices[0]),
          paidAt: dayjs().startOf("day").toISOString(),
        },
  });
  const { allowLeave } = useDiscardGuard(isDirty);

  const loan = loanOf(watch("loanId"));
  const paidAt = watch("paidAt");
  const max = useMemo(
    () => maxPaymentOn(loan, otherPaymentsOf(loan.id), paidAt, today),
    [loan, paidAt, today, loans.paymentsOf]
  );

  // Re-check when balances change, so a transfer in clears the error.
  useEffect(() => {
    if (getValues("amount")) {
      trigger("amount");
    }
  }, [transactions]);

  // Only an edit can lower a balance: a smaller repayment, or one moved to another account.
  function amountOverdraft(amount: string) {
    if (!payment) {
      return undefined;
    }
    return overdraftError(
      [{ accountId: getValues("accountId"), amount: parseFloat(amount) }],
      (t) => t.id === payment.id
    );
  }

  function validateAmount(value: string, values: FormValues) {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0.01) {
      return "Enter at least 0.01";
    }
    const target = loanOf(values.loanId);
    const others = otherPaymentsOf(target.id);
    const next = summarizeLoan({
      loan: target,
      payments: [...others, { amount: parsed, createdAt: values.paidAt }],
      today,
    });
    if (next.isValid) {
      return amountOverdraft(value)?.message ?? true;
    }
    const most = formatAmount(maxPaymentOn(target, others, values.paidAt, today));
    const date = dayjs(values.paidAt);
    return date.isSame(dayjs(), "day")
      ? `More than the ${most} still owed`
      : `The most you can pay on ${date.format("MMM D")} is ${most}`;
  }

  // A new loan or date can put an amount already typed over the limit; say so right away.
  function revalidateAmount() {
    const amount = getValues("amount");
    setValue("amount", amount, { shouldValidate: true, shouldTouch: amount !== "" });
  }

  function followLoan(previous: Loan, next: Loan) {
    // Switch to the new loan's account unless one was picked by hand.
    if (getValues("accountId") === suggestedAccountOf(previous)) {
      setValue("accountId", suggestedAccountOf(next), { shouldDirty: true });
    }
    const lentOn = dayjs(next.lentAt).startOf("day");
    if (dayjs(getValues("paidAt")).isBefore(lentOn)) {
      setValue("paidAt", lentOn.toISOString(), { shouldDirty: true });
    }
    revalidateAmount();
  }

  function payInFull() {
    setValue("amount", max.toFixed(2), { shouldValidate: true, shouldDirty: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      loanId: values.loanId,
      accountId: values.accountId,
      amount: parseFloat(values.amount),
      paidAt: values.paidAt,
    };
    try {
      if (payment) {
        await loans.updatePayment(payment.id, input);
      } else {
        await loans.recordPayment(input);
      }
      allowLeave();
      router.back();
    } catch (e) {
      console.error(isEditing ? "Update payment failed" : "Record payment failed", e);
      alertFailure(isEditing ? "Save failed" : "Payment failed", e);
    }
  });

  function confirmDelete() {
    if (!payment) {
      return;
    }
    Alert.alert("Delete this payment?", "The balance will go back up.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await loans.deletePayment(payment.id);
            allowLeave();
            router.back();
          } catch (e) {
            console.error("Delete payment failed", e);
            alertFailure("Delete failed", e);
          }
        },
      },
    ]);
  }

  const loanOptions = choices.map((choice) => ({
    value: choice.id,
    label: `${formatAmount(loans.summaries[choice.id]?.balance ?? 0)} left · ${dayjs(choice.lentAt).format("MMM D")}`,
  }));

  return (
    <>
      <AppFormHeader title={isEditing ? "Edit payment" : "Record payment"} subtitle={loan.borrower} />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {choices.length > 1 && (
          <Controller
            control={control}
            name="loanId"
            render={({ field: { value, onChange } }) => (
              <AppRadioGroup
                label="Loan"
                options={loanOptions}
                value={value}
                onChange={(nextId) => {
                  const previous = loanOf(value);
                  onChange(nextId);
                  followLoan(previous, loanOf(nextId));
                }}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="amount"
          rules={{ validate: validateAmount }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <AppTextInput
                autoFocus={!isEditing}
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
        {max >= 0.01 && (
          <TouchableOpacity
            onPress={payInFull}
            className="min-h-[44px] justify-center self-start mb-1"
            accessibilityRole="button"
            accessibilityLabel={`Pay in full, ${formatAmount(max)}`}
          >
            <AppText variant="body-bold" className="text-secondary">{`Pay in full · ${formatAmount(max)}`}</AppText>
          </TouchableOpacity>
        )}

        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => (
            <AppSelectField
              label="Paid into"
              value={accounts.find((a) => a.id === value)?.name ?? ""}
              placeholder="Choose account"
              onPress={() => accountSheetRef.current?.present()}
            />
          )}
        />

        <Controller
          control={control}
          name="paidAt"
          render={({ field: { value, onChange } }) => (
            <AppDateField
              label="Date"
              value={value}
              onChange={(iso) => {
                onChange(iso);
                revalidateAmount();
              }}
              minimumDate={dayjs(loan.lentAt).startOf("day").toDate()}
              maximumDate={new Date()}
            />
          )}
        />

        <AppButton
          label={isEditing ? "Save changes" : "Record payment"}
          onPress={onSubmit}
          disabled={!isValid}
          loading={isSubmitting}
          className="mt-4"
        />
        {isEditing && (
          <AppButton label="Delete payment" variant="destructive" onPress={confirmDelete} className="mt-3" />
        )}

        <View className="h-8" />
      </AppFormScrollView>

      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet
            ref={accountSheetRef}
            title="Paid into"
            options={depositAccounts}
            value={value}
            onChange={(accountId) => {
              onChange(accountId);
              revalidateAmount();
            }}
          />
        )}
      />
    </>
  );
}

function MissingState({ message }: { message: string }) {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
      <Feather name="inbox" size={40} color={colors.textMuted} />
      <AppText variant="meta" className="text-center">{message}</AppText>
      <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

interface ScreenProps {
  loanId?: string;
  borrower?: string;
  paymentId?: string;
}

function PaymentScreen({ loanId, borrower, paymentId }: ScreenProps) {
  const loans = useLoans();
  // Resolved once, on open: saving can settle a loan and deleting removes the payment, and the screen shouldn't
  // swap to "no longer exists" while it animates away.
  const [target] = useState(() => {
    const loanIds = loanId
      ? [loanId]
      : orderBy(
          loans.loans.filter((l) => l.borrower === borrower && loans.summaries[l.id]?.isSettled !== true),
          "lentAt",
          "asc"
        ).map(({ id }) => id);
    const payment =
      paymentId && loanIds.length > 0 ? loans.paymentsOf(loanIds[0]).find(({ id }) => id === paymentId) : undefined;
    return { loanIds, payment };
  });
  const choices = orderBy(
    loans.loans.filter(({ id }) => target.loanIds.includes(id)),
    "lentAt",
    "asc"
  );

  if (choices.length === 0) {
    return <MissingState message={loanId ? "This loan no longer exists." : "No active loans for this person."} />;
  }

  if (paymentId && !target.payment) {
    return <MissingState message="This payment no longer exists." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <PaymentForm choices={choices} payment={target.payment} />
    </SafeAreaView>
  );
}

// Record a repayment: `id` for one loan, or `borrower` to pick among that person's active loans. With `paymentId`
// (and `id`) it edits that payment instead.
export default function RecordPaymentScreen() {
  const { id, borrower, paymentId } = useLocalSearchParams<{ id?: string; borrower?: string; paymentId?: string }>();
  const loans = useLoans();
  const accounts = useAccounts();

  if (loans.isLoading || accounts.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return <PaymentScreen loanId={id} borrower={borrower} paymentId={paymentId} />;
}
