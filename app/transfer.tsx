import React, { useRef, useState } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { Controller, useForm } from "react-hook-form";
import dayjs from "dayjs";
import { maxBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { CategoryBottomSheet, type CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDateField } from "@/components/ui/AppDateField";
import { AppDisclosureCard } from "@/components/ui/AppDisclosureCard";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { alertFailure } from "@/utils/accounts/alertFailure";
import type { Account, AccountTransaction, TransferInput } from "@/types";

interface TransferFormValues {
  fromId: string;
  toId: string;
  amount: string;
  fee: string;
  income: string;
  incomeCategory: string;
  incomeAccountId: string; // "" = same as To
  note: string;
  date: string; // ISO
}

interface TransferParts {
  from: AccountTransaction | undefined;
  to: AccountTransaction | undefined;
  // The From side, or the To side when the From account was deleted.
  main: AccountTransaction;
  fee: AccountTransaction | undefined;
  income: AccountTransaction | undefined;
}

// The rows one transfer wrote: both sides, plus any fee or income recorded with it.
function findTransfer(transactions: AccountTransaction[], accounts: Account[], transferId: string): TransferParts | null {
  const rows = transactions.filter((t) => t.transferId === transferId);
  const sides = rows.filter((t) => t.kind === "transfer");
  const isCredit = (t: AccountTransaction) => accounts.find((a) => a.id === t.accountId)?.type === "credit";
  const from = sides.find((t) => t.amount < 0 && !isCredit(t));
  const to = sides.find((t) => t !== from);
  const main = from ?? to;
  if (!main) {
    return null;
  }
  return {
    from,
    to,
    main,
    fee: rows.find((t) => t.kind === "fee"),
    income: rows.find((t) => t.kind === "income"),
  };
}

function validateOptionalAmount(value: string) {
  if (value === "") {
    return true;
  }
  const n = parseFloat(value);
  return (!isNaN(n) && n >= 0) || "Must be ≥ 0";
}

function parseOptionalAmount(value: string) {
  return value === "" ? 0 : parseFloat(value);
}

function formatIncomeSummary(income: number, category: string) {
  if (isNaN(income)) {
    return "Invalid amount";
  }
  return income > 0 ? `${formatAmount(income)} · ${category}` : "None";
}

function formatIncomeHint(toName: string, amount: string, income: number) {
  const transferred = parseFloat(amount);
  return transferred > 0 && income > 0 ? `${toName} receives ${formatAmount(transferred + income)} in total` : null;
}

// Today keeps the current time; an earlier day lands at noon. An edit that keeps the day keeps its original time.
function toCreatedAt(date: string, original: string | undefined) {
  if (original != null && dayjs(date).isSame(original, "day")) {
    return original;
  }
  if (dayjs(date).isSame(dayjs(), "day")) {
    return new Date().toISOString();
  }
  return dayjs(date).hour(12).startOf("hour").toISOString();
}

interface AccountFieldProps {
  label: string;
  options: Account[];
  value: string;
  onChange: (id: string) => void;
}

function AccountField({ label, options, value, onChange }: AccountFieldProps) {
  const { accounts, getBalance } = useAccounts();
  const pickerRef = useRef<AccountPickerSheetRef>(null);
  // Looked up across every account so an archived one on an existing transfer still shows by name.
  const selected = accounts.find((account) => account.id === value);
  return (
    <>
      <AppSelectField
        label={label}
        value={selected?.name ?? ""}
        placeholder="Choose account"
        onPress={() => pickerRef.current?.present()}
        accessibilityLabel={selected ? `${label}, ${selected.name}, ${formatAmount(getBalance(selected.id))}` : `${label}, choose account`}
      />
      <AccountPickerSheet ref={pickerRef} title={label} options={options} value={value} onChange={onChange} />
    </>
  );
}

interface IncomeCategoryFieldProps {
  value: string;
  onChange: (category: string) => void;
}

function IncomeCategoryField({ value, onChange }: IncomeCategoryFieldProps) {
  const sheetRef = useRef<CategoryBottomSheetRef>(null);
  return (
    <>
      <AppSelectField
        label="Category"
        value={value}
        onPress={() => sheetRef.current?.present()}
        accessibilityLabel={`Income category, ${value}`}
      />
      <CategoryBottomSheet ref={sheetRef} kind="income" value={value} onChange={onChange} />
    </>
  );
}

export default function TransferScreen() {
  const { id, accountId, toAccountId, amount } = useLocalSearchParams<{
    id?: string;
    accountId?: string;
    toAccountId?: string;
    amount?: string;
  }>();
  const accounts = useAccounts();
  const isEditing = id != null;
  const parts = id != null ? findTransfer(accounts.transactions, accounts.accounts, id) : null;
  const sources = accounts.activeAccounts.filter((a) => a.type !== "credit");
  const [isIncomeOpen, setIsIncomeOpen] = useState(parts?.income != null);
  const [isDeleting, setIsDeleting] = useState(false);

  function toFormValues(): TransferFormValues {
    const lastTransferIncome = maxBy(
      accounts.transactions.filter((t) => t.kind === "income" && t.transferId != null),
      "createdAt"
    );
    if (parts) {
      const { from, to, main, fee, income } = parts;
      const toId = to?.accountId ?? "";
      const toName = accounts.accounts.find((a) => a.id === toId)?.name;
      const note = main.note ?? "";
      return {
        fromId: from?.accountId ?? "",
        toId,
        amount: Math.abs(main.amount).toString(),
        fee: fee ? Math.abs(fee.amount).toString() : "",
        income: income ? income.amount.toString() : "",
        incomeCategory: income?.category ?? lastTransferIncome?.category ?? "Other",
        incomeAccountId: income && income.accountId !== toId ? income.accountId : "",
        note: note === `Transfer to ${toName}` ? "" : note,
        date: main.createdAt,
      };
    }
    const account = accounts.accounts.find((a) => a.id === accountId);
    const isSource = account == null || account.type !== "credit";
    // "Transfer in" from an overdraft error names the account to fill; the richest other account pays.
    const richestOther = maxBy(
      sources.filter((a) => a.id !== toAccountId),
      (a) => accounts.getBalance(a.id)
    );
    const from = toAccountId
      ? richestOther?.id ?? ""
      : isSource ? account?.id ?? sources[0]?.id ?? "" : sources[0]?.id ?? "";
    const to = toAccountId ?? (isSource ? accounts.activeAccounts.find((a) => a.id !== from)?.id ?? "" : account.id);
    return {
      fromId: from,
      toId: to,
      amount: amount ?? "",
      fee: "",
      income: "",
      incomeCategory: lastTransferIncome?.category ?? "Other",
      incomeAccountId: "",
      note: "",
      date: new Date().toISOString(),
    };
  }

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<TransferFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(),
  });
  const { allowLeave } = useDiscardGuard(isDirty);
  const fromId = watch("fromId");
  const toId = watch("toId");
  const destinations = accounts.activeAccounts.filter((a) => a.id !== fromId);
  const isCreditAccount = (targetId: string) => accounts.accounts.find((a) => a.id === targetId)?.type === "credit";
  const toAccount = accounts.accounts.find((a) => a.id === toId);
  const isBillPayment = toAccount?.type === "credit";
  const canEarnIncome = !isBillPayment;
  const incomeValue = parseOptionalAmount(watch("income"));
  const incomeSummaryClassName = isNaN(incomeValue) ? "text-overdue" : incomeValue > 0 ? "text-secondary" : "text-textMuted";
  const incomeAccountId = watch("incomeAccountId") || toId;
  const isIncomeToDestination = incomeAccountId === toId;
  const incomeHint = toAccount && isIncomeToDestination ? formatIncomeHint(toAccount.name, watch("amount"), incomeValue) : null;
  // Money can't move in or out of an archived account, so one left on an existing transfer blocks saving it.
  const archivedAccount = [fromId, toId, incomeValue > 0 ? incomeAccountId : ""]
    .map((targetId) => accounts.accounts.find((a) => a.id === targetId))
    .find((account) => account?.archivedAt != null);
  const title = isBillPayment
    ? isEditing ? "Edit bill payment" : `Pay ${toAccount.name} bill`
    : isEditing ? "Edit transfer" : "Transfer";
  const submitLabel = isEditing ? "Save changes" : isBillPayment ? "Pay bill" : "Transfer";

  React.useEffect(() => {
    if (!accounts.isLoading) {
      // A plain reset drops the field rules, so the trigger below would validate nothing
      reset(toFormValues(), { keepFieldsRef: true });
      if (amount || isEditing) {
        trigger("amount");
      }
    }
  }, [accounts.isLoading]);

  // Editing swaps out the saved rows, so the destination's credit counts as well as the source's debit.
  function amountOverdraft({ fromId: from, toId: to, amount: value, fee, income, incomeAccountId: incomeTo }: TransferFormValues) {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0.01) {
      return undefined;
    }
    return accounts.overdraftError(
      [
        { accountId: from, amount: -(n + (parseOptionalAmount(fee) || 0)) },
        { accountId: to, amount: n },
        { accountId: incomeTo || to, amount: parseOptionalAmount(income) || 0 },
      ],
      id != null ? (t) => t.transferId === id : undefined
    );
  }

  const onSubmit = handleSubmit(async (data) => {
    const input: TransferInput = {
      fromId: data.fromId,
      toId: data.toId,
      amount: parseFloat(data.amount),
      fee: parseOptionalAmount(data.fee),
      income: parseOptionalAmount(data.income),
      incomeCategory: data.incomeCategory,
      incomeAccountId: data.incomeAccountId || data.toId,
      note: data.note.trim() || null,
      createdAt: toCreatedAt(data.date, parts?.main.createdAt),
    };
    try {
      if (id != null) {
        await accounts.updateTransfer(id, input);
      } else {
        await accounts.transfer(input);
      }
      allowLeave();
      router.back();
    } catch (e) {
      console.error(isEditing ? "Update transfer failed" : "Transfer failed", e);
      alertFailure(isEditing ? "Save failed" : "Transfer failed", e);
    }
  });

  function confirmDelete() {
    if (id == null) {
      return;
    }
    const transferId = id;
    Alert.alert(
      "Delete transfer?",
      "Both sides of this transfer and any fee or income recorded with it are removed, and the balances restored.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Keeps the form up while the screen closes, instead of flashing "no longer exists".
            setIsDeleting(true);
            try {
              await accounts.deleteTransfer(transferId);
              allowLeave();
              router.back();
            } catch (e) {
              setIsDeleting(false);
              console.error("Delete transfer failed", e);
              alertFailure("Delete failed", e);
            }
          },
        },
      ]
    );
  }

  if (isEditing && accounts.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (isEditing && !parts && !isDeleting) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">This transfer no longer exists.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title={title} />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sources.length === 0 ? (
          <AppText variant="meta" className="mb-3">
            Add a debit or cash account to transfer money from.
          </AppText>
        ) : (
          <Controller
            control={control}
            name="fromId"
            rules={{ required: true, deps: "amount" }}
            render={({ field: { value, onChange } }) => (
              <AccountField
                label="From"
                options={sources}
                value={value}
                onChange={(picked) => {
                  onChange(picked);
                  if (picked === getValues("toId")) {
                    setValue("toId", "", { shouldValidate: true });
                  }
                }}
              />
            )}
          />
        )}
        {destinations.length === 0 ? (
          <AppText variant="meta" className="mb-3">
            Add another account to transfer to.
          </AppText>
        ) : (
          <Controller
            control={control}
            name="toId"
            rules={{ required: true, validate: (v, values) => v !== values.fromId, deps: "amount" }}
            render={({ field: { value, onChange } }) => (
              <AccountField
                label="To"
                options={destinations}
                value={value}
                onChange={(picked) => {
                  onChange(picked);
                  if (isCreditAccount(picked)) {
                    setValue("income", "", { shouldValidate: true });
                  }
                }}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="amount"
          rules={{
            validate: (v, values) => {
              if (v.trim() === "") {
                return "Enter an amount";
              }
              const n = parseFloat(v);
              if (isNaN(n) || n < 0.01) {
                return "Must be ≥ 0.01";
              }
              return amountOverdraft(values)?.message ?? true;
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Amount (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              error={fieldState.isTouched || amountOverdraft(getValues()) ? fieldState.error?.message : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field: { value, onChange } }) => (
            <AppDateField label="Date" value={value} onChange={onChange} maximumDate={new Date()} />
          )}
        />
        <Controller
          control={control}
          name="fee"
          rules={{ validate: validateOptionalAmount, deps: "amount" }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Transfer fee (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional, deducted from From"
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
            />
          )}
        />
        {canEarnIncome && (
          <AppDisclosureCard
            title="Income"
            description="Earned on this transfer, like a cash-out fee"
            summary={formatIncomeSummary(incomeValue, watch("incomeCategory"))}
            summaryClassName={incomeSummaryClassName}
            isOpen={isIncomeOpen}
            onToggle={setIsIncomeOpen}
          >
            <Controller
              control={control}
              name="income"
              rules={{ validate: validateOptionalAmount, deps: "amount" }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Amount earned (₱)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  error={fieldState.isTouched ? fieldState.error?.message : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="incomeCategory"
              render={({ field: { value, onChange } }) => <IncomeCategoryField value={value} onChange={onChange} />}
            />
            <Controller
              control={control}
              name="incomeAccountId"
              rules={{ deps: "amount" }}
              render={({ field: { value, onChange } }) => (
                <AccountField label="Deposit to" options={sources} value={value || toId} onChange={onChange} />
              )}
            />
            {incomeHint && (
              <AppText variant="meta" className="mt-3">
                {incomeHint}
              </AppText>
            )}
          </AppDisclosureCard>
        )}
        <Controller
          control={control}
          name="note"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppTextInput
              label="Note"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              maxLength={100}
            />
          )}
        />
        <AppButton
          label={submitLabel}
          onPress={onSubmit}
          disabled={!isValid || sources.length === 0 || destinations.length === 0 || archivedAccount != null}
          loading={isSubmitting}
          className="mt-4"
        />
        {archivedAccount && (
          <AppText variant="meta" className="text-center mt-2">
            {`${archivedAccount.name} is archived. Unarchive it or choose another account to save.`}
          </AppText>
        )}
        {isEditing && (
          <AppButton label="Delete transfer" variant="destructive" onPress={confirmDelete} className="mt-3" />
        )}
      </AppFormScrollView>
    </SafeAreaView>
  );
}
