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
import { AppSelectField } from "@/components/ui/AppSelectField";
import { LoadingState } from "@/components/ui/LoadingState";
import { TransferInButton } from "@/components/accounts/TransferInButton";
import { IncomeCategoryField } from "@/components/accounts/IncomeCategoryField";
import { LoanSplitPreview } from "@/components/loans/LoanSplitPreview";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { maxPaymentOn } from "@/utils/loans/maxPaymentOn";
import { splitLoanPayment, type TLoanPaymentSplit, type TLoanPaymentTarget } from "@/utils/loans/splitLoanPayment";
import { formatAmount } from "@/utils/dateHelpers";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { OVERPAYMENT_CATEGORY } from "@/constants/categories";
import { colors } from "@/constants/theme";
import type { AccountTransaction, Loan } from "@/types";

interface FormValues {
  amount: string;
  accountId: string;
  paidAt: string;
  excessCategory: string;
}

interface FormProps {
  // The loans this payment is split across: one, or each active loan of a borrower (oldest first).
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

  function suggestedAccountOf(loan: Loan) {
    return depositAccounts.some((a) => a.id === loan.accountId) ? loan.accountId : CASH_ACCOUNT_ID;
  }

  function excessOf({ total, unplaced }: TLoanPaymentSplit) {
    return !isEditing && total >= 0.01 ? unplaced : 0;
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
          amount: Math.abs(payment.amount).toFixed(2),
          accountId: payment.accountId,
          paidAt: payment.createdAt,
          excessCategory: OVERPAYMENT_CATEGORY,
        }
      : {
          amount: "",
          accountId: suggestedAccountOf(choices[0]),
          paidAt: dayjs().startOf("day").toISOString(),
          excessCategory: OVERPAYMENT_CATEGORY,
        },
  });
  const { allowLeave } = useDiscardGuard(isDirty);

  // A loan's cap depends only on the date, so caps are worked out once per date, not on every keystroke.
  const targetsOn = useMemo(() => {
    const cache = new Map<string, TLoanPaymentTarget[]>();
    return (paidAt: string) => {
      const cached = cache.get(paidAt);
      if (cached) {
        return cached;
      }
      const targets = choices.map((loan) => {
        // The payment being edited is left out so it doesn't count against itself.
        const payments = loans.paymentsOf(loan.id).filter(({ id }) => id !== payment?.id);
        return { loan, payments, cap: maxPaymentOn({ loan, payments, paidAt, today }) };
      });
      cache.set(paidAt, targets);
      return targets;
    };
  }, [choices, loans.paymentsOf, payment?.id, today]);

  function splitFor(amount: string, paidAt: string) {
    return splitLoanPayment({ amount: parseFloat(amount), targets: targetsOn(paidAt), paidAt, today });
  }

  // The split being saved stays on screen while it animates away; the saved payment would otherwise re-split
  // against the new balances.
  const [savedSplit, setSavedSplit] = useState<TLoanPaymentSplit>();
  const split = savedSplit ?? splitFor(watch("amount"), watch("paidAt"));
  const excess = excessOf(split);

  // Re-check when balances change, so a transfer in clears the error.
  useEffect(() => {
    if (getValues("amount") && !savedSplit) {
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
    const checked = splitFor(value, values.paidAt);
    if (checked.unplaced <= 0) {
      return amountOverdraft(value)?.message ?? true;
    }
    const hasExcess = excessOf(checked) > 0;
    if (hasExcess) {
      return true;
    }
    const most = formatAmount(checked.total);
    const date = dayjs(values.paidAt);
    return date.isSame(dayjs(), "day")
      ? `More than the ${most} still owed`
      : `The most you can pay on ${date.format("MMM D")} is ${most}`;
  }

  // A new date can put the amount over the limit and a new account can change the overdraft check; say so right
  // away.
  function revalidateAmount() {
    const amount = getValues("amount");
    setValue("amount", amount, { shouldValidate: true, shouldTouch: amount !== "" });
  }

  function payInFull() {
    setValue("amount", split.total.toFixed(2), { shouldValidate: true, shouldDirty: true });
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = splitFor(values.amount, values.paidAt);
      setSavedSplit(saved);
      if (payment) {
        await loans.updatePayment(payment.id, {
          loanId: choices[0].id,
          accountId: values.accountId,
          amount: parseFloat(values.amount),
          paidAt: values.paidAt,
        });
      } else {
        const payments = saved.parts
          .filter(({ share }) => share >= 0.01)
          .map(({ loan, share }) => ({
            loanId: loan.id,
            accountId: values.accountId,
            amount: share,
            paidAt: values.paidAt,
          }));
        const savedExcess = excessOf(saved);
        await loans.recordPayments(
          payments,
          savedExcess > 0 ? { amount: savedExcess, category: values.excessCategory } : undefined
        );
      }
      allowLeave();
      router.back();
    } catch (e) {
      setSavedSplit(undefined);
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

  const splitAction = choices.length > 1
    ? { label: "Save", onPress: onSubmit, isDisabled: !isValid, isLoading: isSubmitting }
    : undefined;

  return (
    <>
      <AppFormHeader
        title={isEditing ? "Edit payment" : "Record payment"}
        subtitle={choices[0].borrower}
        action={splitAction}
      />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
                error={
                  fieldState.isTouched || amountOverdraft(value) || (split.unplaced > 0 && excess === 0)
                    ? fieldState.error?.message
                    : undefined
                }
              />
              <TransferInButton fieldError={fieldState.error?.message} overdraft={amountOverdraft(value)} />
            </>
          )}
        />
        {split.total >= 0.01 && (
          <TouchableOpacity
            onPress={payInFull}
            className="min-h-[44px] justify-center self-start mb-1"
            accessibilityRole="button"
            accessibilityLabel={`Pay in full, ${formatAmount(split.total)}`}
          >
            <AppText variant="body-bold" className="text-secondary">
              {`Pay in full · ${formatAmount(split.total)}`}
            </AppText>
          </TouchableOpacity>
        )}
        {choices.length > 1 && <LoanSplitPreview parts={split.parts} />}
        {excess > 0 && (
          <>
            <AppText variant="meta" className="mt-3 mb-1">
              {`${formatAmount(excess)} more than owed · saved as income`}
            </AppText>
            <Controller
              control={control}
              name="excessCategory"
              render={({ field: { value, onChange } }) => <IncomeCategoryField value={value} onChange={onChange} />}
            />
          </>
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
              minimumDate={dayjs(choices[0].lentAt).startOf("day").toDate()}
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
      paymentId && loanId ? loans.paymentsOf(loanId).find(({ id }) => id === paymentId) : undefined;
    return { loanIds, payment };
  });
  const choices = useMemo(
    () => orderBy(loans.loans.filter(({ id }) => target.loanIds.includes(id)), "lentAt", "asc"),
    [loans.loans, target.loanIds]
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

// Record a repayment: `id` for one loan, or `borrower` to split it across that person's active loans. With
// `paymentId` (and `id`) it edits that payment instead.
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
