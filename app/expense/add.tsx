import React, { useRef } from "react";
import { maxBy } from "@/utils/collections";
import { useUpdateEffect } from "@/utils/useUpdateEffect";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { useExpenses } from "@/context/ExpenseContext";
import { isPaymentFor, useAccounts } from "@/context/AccountContext";
import { CategoryBottomSheet, CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AccountPickerSheet, AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppCheckRow } from "@/components/ui/AppCheckRow";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppDayField } from "@/components/ui/AppDayField";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppMonthField } from "@/components/ui/AppMonthField";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { TransferInButton } from "@/components/accounts/TransferInButton";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { formatOrdinal, getDueDateForMonth } from "@/utils/dateHelpers";
import { maybeAskForReminders } from "@/utils/reminderPermission";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { useDeleteExpense } from "@/utils/useDeleteExpense";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import type { Expense, Recurrence, ExpenseFormValues, TOption } from "@/types";

type ExpenseType = "regular" | "recurring";

const TYPE_TABS: TOption<ExpenseType>[] = [
  { label: "One-time", value: "regular" },
  { label: "Recurring", value: "recurring" },
];

const RECURRENCE_OPTIONS: TOption<Recurrence>[] = [
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

// Days before the due date. "0" turns the bill's reminder off; an empty value is the default, a day before.
const REMINDER_OPTIONS = [
  { label: "Off", value: "0" },
  { label: "1 day", value: "1" },
  { label: "2 days", value: "2" },
  { label: "3 days", value: "3" },
  { label: "1 week", value: "7" },
];
const DEFAULT_REMINDER = "1";

const monthStart = (year: number, month: number) => new Date(year, month, 1).toISOString();
const monthIndex = (iso: string) => dayjs(iso).year() * 12 + dayjs(iso).month();

function isDayOfMonth(value: string): boolean {
  const day = parseInt(value, 10);
  return !isNaN(day) && day >= 1 && day <= 31;
}

function isValidAmount(value: string): boolean {
  const amount = parseFloat(value);
  return !isNaN(amount) && amount >= 0.01;
}

// A lead time the chips don't offer (the old typed field took 1–14 days) stays pickable as its own chip.
function reminderOptionsFor(stored: number | null | undefined) {
  if (stored == null || stored < 1 || REMINDER_OPTIONS.some((option) => option.value === String(stored))) {
    return REMINDER_OPTIONS;
  }
  return [...REMINDER_OPTIONS, { label: `${stored} days`, value: String(stored) }].sort(
    (a, b) => Number(a.value) - Number(b.value)
  );
}

// Whether a stack screen (the bill screen or an editor) is about this expense; params are its URL params.
function isScreenOfExpense(route: { name: string; params?: object }, expenseId: string | undefined): boolean {
  return (
    route.name.startsWith("expense/") && route.params != null && "id" in route.params && route.params.id === expenseId
  );
}

function startOf(expense: Expense | null, fallbackYear: number, fallbackMonth: number): string {
  if (expense?.startYear != null && expense.startMonth != null) {
    return monthStart(expense.startYear, expense.startMonth);
  }
  return expense ? dayjs(expense.createdAt).startOf("month").toISOString() : monthStart(fallbackYear, fallbackMonth);
}

function endOf(expense: Expense | null, fallbackYear: number, fallbackMonth: number): string {
  return expense?.endYear != null
    ? monthStart(expense.endYear, expense.endMonth ?? 0)
    : monthStart(fallbackYear, fallbackMonth);
}

export default function AddExpenseScreen() {
  const { id, year: yearParam, month: monthParam, type, endPrompt } = useLocalSearchParams<{
    id?: string;
    year?: string;
    month?: string;
    type?: ExpenseType;
    endPrompt?: string; // "1" from the delete dialog's "Set end month": opens with the end month switched on
  }>();
  const { addExpense, updateExpense, expenses, getMonthAmount } = useExpenses();
  const confirmDelete = useDeleteExpense();
  const navigation = useNavigation();
  const now = new Date();
  const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const currentMonth = monthParam ? parseInt(monthParam, 10) : now.getMonth();
  const editingExpense = id ? expenses.find((e) => e.id === id) ?? null : null;
  const isEditing = editingExpense !== null;
  const isRegular = editingExpense ? editingExpense.recurrence === "one-off" : type === "regular";
  const lastUsedCategory = maxBy(expenses, "createdAt")?.category ?? "Other";
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const { accounts, activeAccounts, transactions, overdraftError, isLoading: isAccountsLoading } = useAccounts();
  const lastUsedAccountId = maxBy(
    expenses.filter((e) => activeAccounts.some((a) => a.id === e.accountId)),
    "createdAt"
  )?.accountId;
  const initialAccountId = editingExpense ? editingExpense.accountId : lastUsedAccountId;
  const reminderOptions = reminderOptionsFor(editingExpense?.reminderDaysBefore);

  function toKnownAccountId(accountId?: string | null) {
    return accountId && accounts.some((a) => a.id === accountId) ? accountId : CASH_ACCOUNT_ID;
  }

  const {
    control,
    handleSubmit,
    reset,
    resetField,
    setValue,
    getValues,
    trigger,
    watch,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<ExpenseFormValues>({
    mode: "onChange",
    defaultValues: {
      amount: editingExpense?.amount != null ? editingExpense.amount.toString() : "",
      category: editingExpense?.category ?? lastUsedCategory,
      // A new recurring bill starts without a due day, so it's picked rather than silently left on the 1st.
      dueDay: editingExpense?.dueDay?.toString() ?? "",
      recurrence: editingExpense?.recurrence ?? (type === "regular" ? "one-off" : "monthly"),
      isVariable: editingExpense?.isVariable ?? false,
      notes: editingExpense?.notes || editingExpense?.name || "",
      reminderDaysBefore: "",
      paidDate: editingExpense?.paidDate ?? new Date().toISOString(),
      startDate: startOf(editingExpense, currentYear, currentMonth),
      hasEndDate: editingExpense?.endYear != null || endPrompt === "1",
      endDate: endOf(editingExpense, currentYear, currentMonth),
      accountId: toKnownAccountId(initialAccountId),
    },
  });
  const { allowLeave } = useDiscardGuard(isDirty);

  const amountWatched = watch("amount");
  const isVariableWatched = watch("isVariable");
  const hasEndDateWatched = watch("hasEndDate");
  const accountIdWatched = watch("accountId");
  const isYearlyWatched = watch("recurrence") === "yearly";
  const startDateWatched = watch("startDate");
  const endDateWatched = watch("endDate");
  const dueDayWatched = watch("dueDay");
  const payCard = isRegular
    ? undefined
    : accounts.find((a) => a.id === accountIdWatched && a.type === "credit");
  const isVariableAmount = !!payCard || isVariableWatched;

  function amountOverdraft(amount: string) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return undefined;
    }
    if (isRegular) {
      return overdraftError(
        [{ accountId: getValues("accountId"), amount: -parsedAmount }],
        editingExpense ? isPaymentFor(editingExpense.id, null, null) : undefined
      );
    }
    if (!editingExpense || !isVariableAmount) {
      return undefined;
    }
    const isPaidCycle = isPaymentFor(editingExpense.id, currentYear, currentMonth);
    const payment = transactions.find(isPaidCycle);
    return payment && overdraftError([{ accountId: payment.accountId, amount: -parsedAmount }], isPaidCycle);
  }
  // Ends can't be before this month (or before the plan starts).
  const earliestEnd = dayjs(
    Math.max(new Date(now.getFullYear(), now.getMonth(), 1).getTime(), dayjs(startDateWatched).startOf("month").valueOf())
  ).toDate();
  const yearlyDueDay = payCard ? payCard.dueDay ?? 1 : parseInt(dueDayWatched, 10);
  const yearlyCaption = `Due every ${dayjs(
    yearlyDueDay >= 1 && yearlyDueDay <= 31
      ? getDueDateForMonth(yearlyDueDay, dayjs(startDateWatched).year(), dayjs(startDateWatched).month())
      : startDateWatched
  ).format(yearlyDueDay >= 1 && yearlyDueDay <= 31 ? "MMMM D" : "MMMM")}`;
  const title = isEditing
    ? isRegular ? "Edit expense" : "Edit recurring bill"
    : isRegular ? "Add expense" : "Add recurring bill";

  React.useEffect(() => {
    if (
      !isAccountsLoading &&
      getValues("accountId") === CASH_ACCOUNT_ID
    ) {
      // Becomes the field's starting value, so accounts finishing loading doesn't count as an edit.
      resetField("accountId", { defaultValue: toKnownAccountId(initialAccountId) });
    }
  }, [isAccountsLoading]);

  // Loads the expense into the form, and picks up changes saved elsewhere (e.g. "Set end month" from the delete
  // dialog) while this form has none of its own.
  React.useEffect(() => {
    if (editingExpense && !isDirty && !isSubmitting) {
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
        reminderDaysBefore: editingExpense.reminderDaysBefore != null ? editingExpense.reminderDaysBefore.toString() : "",
        paidDate: editingExpense.paidDate ?? new Date().toISOString(),
        startDate: startOf(editingExpense, currentYear, currentMonth),
        hasEndDate: editingExpense.endYear != null || endPrompt === "1",
        endDate: endOf(editingExpense, currentYear, currentMonth),
        accountId: toKnownAccountId(editingExpense.accountId),
      });
    }
  }, [editingExpense]);

  // Switching the type, the card or the variable amount changes which fields show and what Amount accepts, so the
  // form is re-checked once the new fields have mounted.
  useUpdateEffect(() => {
    trigger();
  }, [isRegular, !!payCard, isVariableAmount]);

  function switchType(next: ExpenseType) {
    if (next === (isRegular ? "regular" : "recurring")) {
      return;
    }
    router.setParams({ type: next });
    setValue("recurrence", next === "regular" ? "one-off" : "monthly");
  }

  React.useEffect(() => {
    if (getValues("amount") !== "") {
      trigger("amount");
    }
  }, [accountIdWatched, isVariableAmount, transactions]);

  const onSubmit = handleSubmit(async (data) => {
    const isVar = isRegular ? false : !!payCard || data.isVariable;
    const parsedAmount = data.amount.trim() !== "" ? parseFloat(data.amount) : null;
    const endActive = !isRegular && data.hasEndDate;
    const endParsed = endActive ? dayjs(data.endDate).toDate() : null;
    const startParsed = isRegular ? null : dayjs(data.startDate);
    const reminder = data.reminderDaysBefore.trim();

    const fields: Omit<Expense, "id" | "createdAt"> = {
      name: "",
      amount: isVar ? null : parsedAmount,
      category: data.category,
      dueDay: isRegular ? 1 : payCard ? payCard.dueDay ?? 1 : parseInt(data.dueDay, 10),
      recurrence: isRegular ? "one-off" : data.recurrence,
      isVariable: isVar,
      status: editingExpense?.status ?? "unpaid",
      notes: data.notes.trim() || undefined,
      // "0" is off, empty is the default (a day before).
      reminderDaysBefore: isRegular || payCard ? null : reminder === "" ? null : parseInt(reminder, 10),
      paidDate: isRegular ? data.paidDate : null,
      startYear: startParsed ? startParsed.year() : null,
      startMonth: startParsed ? startParsed.month() : null,
      endYear: endParsed ? endParsed.getFullYear() : null,
      endMonth: endParsed ? endParsed.getMonth() : null,
      accountId: data.accountId,
    };
    const monthlyAmount = isVar ? { year: currentYear, month: currentMonth, amount: parsedAmount } : undefined;

    try {
      if (isEditing && id) {
        await updateExpense(id, fields, monthlyAmount);
      } else {
        await addExpense(fields, monthlyAmount);
      }
    } catch (e) {
      alertFailure("Save failed", e);
      return;
    }
    allowLeave();
    router.back();
    if (!isEditing && !isRegular && fields.reminderDaysBefore !== 0) {
      try {
        await maybeAskForReminders(data.notes.trim() || data.category);
      } catch (e) {
        console.error("Asking for reminders failed", e);
      }
    }
  });

  // Names what keeps Save disabled, in the order the fields appear.
  function describeSaveBlocker(): string {
    const isAmountEmpty = amountWatched.trim() === "";
    if (!isVariableAmount && isAmountEmpty && isRegular) {
      return "Enter an amount to save";
    }
    if (!isVariableAmount && !isAmountEmpty && !isValidAmount(amountWatched)) {
      return "Fix the amount to save";
    }
    if (!isRegular && !payCard && !isDayOfMonth(dueDayWatched)) {
      return "Pick a due day to save";
    }
    if (!isRegular && hasEndDateWatched && monthIndex(endDateWatched) < monthIndex(startDateWatched)) {
      return "Pick an end month after the start";
    }
    return "Fill in the required fields to save";
  }
  const saveHint = describeSaveBlocker();

  function handleDelete() {
    if (!editingExpense) {
      return;
    }
    confirmDelete(editingExpense, currentYear, currentMonth, () => {
      allowLeave();
      // The bill screen (or another editor) for this expense underneath closes too, so nothing lands on a bill
      // that's gone. Screens for anything else stay.
      const routes = navigation.getState()?.routes ?? [];
      let count = 1;
      while (count < routes.length - 1 && isScreenOfExpense(routes[routes.length - 1 - count], id)) {
        count += 1;
      }
      router.dismiss(count);
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={title}
        action={{
          label: "Save",
          onPress: onSubmit,
          isDisabled: !isValid || isAccountsLoading,
          isLoading: isSubmitting,
          accessibilityHint: isValid ? undefined : saveHint,
        }}
      />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!isEditing && (
          <AppTabs
            tabs={TYPE_TABS}
            value={isRegular ? "regular" : "recurring"}
            onChange={switchType}
            className="mb-2"
          />
        )}

        <Controller
          control={control}
          name="accountId"
          render={({ field: { value } }) => (
            <AppSelectField
              label="Pay from"
              value={accounts.find((a) => a.id === value)?.name ?? "Cash"}
              onPress={() => accountSheetRef.current?.present()}
              caption={
                payCard
                  ? payCard.dueDay != null ? `Due with the card bill (day ${payCard.dueDay})` : "Due with the card bill"
                  : undefined
              }
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { value } }) => (
            <AppSelectField
              label="Category"
              value={value}
              onPress={() => categorySheetRef.current?.present()}
            />
          )}
        />

        <Controller
          control={control}
          name="amount"
          rules={{
            validate: (v) => {
              if (!isVariableAmount) {
                if (v === "" || v === undefined) {
                  // A regular expense is money already spent, so it needs an amount.
                  return isRegular ? "Enter an amount" : true;
                }
                if (!isValidAmount(v)) {
                  return "Must be ≥ 0.01";
                }
              }
              return amountOverdraft(v)?.message ?? true;
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <>
              <AppTextInput
                autoFocus={!id}
                label={isVariableAmount ? "This month's amount (₱)" : "Amount (₱)"}
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

        {/* The bill's title in every list (stored as notes). */}
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Netflix"
              maxLength={200}
              returnKeyType="done"
            />
          )}
        />

        {isRegular && (
          <Controller
            control={control}
            name="paidDate"
            render={({ field: { value, onChange } }) => (
              <AppDateField label="Paid date" value={value} onChange={onChange} maximumDate={new Date()} />
            )}
          />
        )}

        {!isRegular && (
          <>
            {!payCard && (
              <Controller
                control={control}
                name="dueDay"
                rules={{ validate: (v) => isDayOfMonth(v) || "Pick a due day" }}
                render={({ field: { value, onChange, onBlur }, fieldState }) => (
                  <AppDayField
                    label="Due"
                    value={value}
                    onChange={(day) => {
                      onChange(day);
                      onBlur();
                    }}
                    format={(day) =>
                      isYearlyWatched
                        ? `Every ${dayjs(startDateWatched).format("MMMM")} ${formatOrdinal(day)}`
                        : `Every month on the ${formatOrdinal(day)}`
                    }
                    error={fieldState.isTouched ? fieldState.error?.message : undefined}
                  />
                )}
              />
            )}

            <Controller
              control={control}
              name="recurrence"
              render={({ field: { value, onChange } }) => (
                <AppRadioGroup label="Repeats" options={RECURRENCE_OPTIONS} value={value} onChange={onChange} />
              )}
            />

            {!payCard && (
              <Controller
                control={control}
                name="reminderDaysBefore"
                render={({ field: { value, onChange } }) => {
                  const shown = value.trim() === "" ? DEFAULT_REMINDER : value;
                  return (
                    <AppRadioGroup
                      label="Reminder"
                      options={reminderOptions}
                      value={shown}
                      onChange={(next) => {
                        if (next !== shown) {
                          onChange(next);
                        }
                      }}
                    />
                  );
                }}
              />
            )}

            {/* First month with a payment due. For yearly plans it's also the month it comes back every year. */}
            <Controller
              control={control}
              name="startDate"
              render={({ field: { value, onChange } }) => (
                <AppMonthField
                  label={isYearlyWatched ? "First due" : "Starts"}
                  value={value}
                  onChange={(iso) => {
                    onChange(iso);
                    trigger("endDate");
                  }}
                  caption={isYearlyWatched ? yearlyCaption : undefined}
                />
              )}
            />

            {!payCard && (
              <Controller
                control={control}
                name="isVariable"
                render={({ field: { value, onChange } }) => (
                  <AppCheckRow
                    label="Variable amount"
                    description="Amount changes each month"
                    checked={value}
                    onToggle={onChange}
                  />
                )}
              />
            )}

            <Controller
              control={control}
              name="hasEndDate"
              render={({ field: { value, onChange } }) => (
                <AppCheckRow
                  label="Set an end month"
                  description="Stops recurring after this month"
                  checked={value}
                  onToggle={(checked) => {
                    onChange(checked);
                    trigger("endDate");
                  }}
                />
              )}
            />
            {hasEndDateWatched && (
              <Controller
                control={control}
                name="endDate"
                rules={{
                  validate: (v, values) =>
                    !values.hasEndDate ||
                    monthIndex(v) >= monthIndex(values.startDate) ||
                    `Can't end before ${dayjs(values.startDate).format("MMM YYYY")}`,
                }}
                render={({ field: { value, onChange, onBlur }, fieldState }) => (
                  <AppMonthField
                    label="Ends"
                    value={value}
                    minimumMonth={earliestEnd}
                    onChange={(iso) => {
                      onChange(iso);
                      onBlur();
                    }}
                    error={fieldState.isTouched ? fieldState.error?.message : undefined}
                  />
                )}
              />
            )}
          </>
        )}

        <AppButton
          label={isEditing ? "Save changes" : "Save expense"}
          onPress={onSubmit}
          disabled={!isValid || isAccountsLoading}
          loading={isSubmitting}
          accessibilityHint={isValid ? undefined : saveHint}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">{saveHint}</AppText>
        )}

        {isEditing && (
          <AppButton label="Delete expense" variant="destructive" onPress={handleDelete} className="mt-6" />
        )}

        <View className="h-8" />
      </AppFormScrollView>

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
      <Controller
        control={control}
        name="accountId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet ref={accountSheetRef} value={value} onChange={onChange} />
        )}
      />
    </SafeAreaView>
  );
}
