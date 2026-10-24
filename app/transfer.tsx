import React, { useRef, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import maxBy from "lodash/maxBy";
import { useAccounts } from "@/context/AccountContext";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { CategoryBottomSheet, type CategoryBottomSheetRef } from "@/components/CategoryBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDisclosureCard } from "@/components/ui/AppDisclosureCard";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { Account } from "@/types";

interface TransferFormValues {
  fromId: string;
  toId: string;
  amount: string;
  fee: string;
  income: string;
  incomeCategory: string;
  incomeAccountId: string; // "" = same as To
  note: string;
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

interface PickerRowProps {
  label: string;
  value: string | undefined;
  placeholder?: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function PickerRow({ label, value, placeholder, accessibilityLabel, onPress }: PickerRowProps) {
  return (
    <>
      <AppLabel>{label}</AppLabel>
      <TouchableOpacity
        className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <AppText
          variant="body-medium"
          className={`text-base ${value ? "text-white" : "text-textMuted"}`}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </AppText>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </>
  );
}

interface AccountFieldProps {
  label: string;
  options: Account[];
  value: string;
  onChange: (id: string) => void;
  getBalance: (id: string) => number;
}

function AccountField({ label, options, value, onChange, getBalance }: AccountFieldProps) {
  const pickerRef = useRef<AccountPickerSheetRef>(null);
  const selected = options.find((option) => option.id === value);
  return (
    <>
      <PickerRow
        label={label}
        value={selected?.name}
        placeholder="Choose account"
        accessibilityLabel={selected ? `${label}, ${selected.name}, ${formatAmount(getBalance(selected.id))}` : `${label}, choose account`}
        onPress={() => pickerRef.current?.present()}
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
      <PickerRow
        label="Category"
        value={value}
        accessibilityLabel={`Income category, ${value}`}
        onPress={() => sheetRef.current?.present()}
      />
      <CategoryBottomSheet ref={sheetRef} kind="income" value={value} onChange={onChange} />
    </>
  );
}

export default function TransferScreen() {
  const { accountId, amount } = useLocalSearchParams<{ accountId?: string; amount?: string }>();
  const accounts = useAccounts();
  const sources = accounts.accounts.filter((a) => a.type !== "credit");
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);

  function toFormValues(): TransferFormValues {
    const account = accounts.accounts.find((a) => a.id === accountId);
    const isSource = account == null || account.type !== "credit";
    const from = isSource ? account?.id ?? sources[0]?.id ?? "" : sources[0]?.id ?? "";
    const to = isSource ? accounts.accounts.find((a) => a.id !== from)?.id ?? "" : account.id;
    const lastTransferIncome = maxBy(
      accounts.transactions.filter((t) => t.kind === "income" && t.transferId != null),
      "createdAt"
    );
    return {
      fromId: from,
      toId: to,
      amount: amount ?? "",
      fee: "",
      income: "",
      incomeCategory: lastTransferIncome?.category ?? "Other",
      incomeAccountId: "",
      note: "",
    };
  }

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isValid, isSubmitting },
  } = useForm<TransferFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(),
  });
  const fromId = watch("fromId");
  const toId = watch("toId");
  const destinations = accounts.accounts.filter((a) => a.id !== fromId);
  const isCreditAccount = (id: string) => accounts.accounts.find((a) => a.id === id)?.type === "credit";
  const toAccount = accounts.accounts.find((a) => a.id === toId);
  const canEarnIncome = toAccount?.type !== "credit";
  const incomeValue = parseOptionalAmount(watch("income"));
  const incomeSummaryClassName = isNaN(incomeValue) ? "text-overdue" : incomeValue > 0 ? "text-secondary" : "text-textMuted";
  const isIncomeToDestination = (watch("incomeAccountId") || toId) === toId;
  const incomeHint = toAccount && isIncomeToDestination ? formatIncomeHint(toAccount.name, watch("amount"), incomeValue) : null;

  React.useEffect(() => {
    if (!accounts.isLoading) {
      reset(toFormValues());
    }
  }, [accounts.isLoading]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await accounts.transfer({
        fromId: data.fromId,
        toId: data.toId,
        amount: parseFloat(data.amount),
        fee: parseOptionalAmount(data.fee),
        income: parseOptionalAmount(data.income),
        incomeCategory: data.incomeCategory,
        incomeAccountId: data.incomeAccountId || data.toId,
        note: data.note.trim() || null,
      });
      router.back();
    } catch (e) {
      console.error("Transfer failed", e);
      Alert.alert("Transfer failed", "Something went wrong. Please try again.");
    }
  });

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
        <AppText variant="title" className="flex-1 text-center" numberOfLines={1}>
          Transfer
        </AppText>
        <View className="w-11" />
      </View>

      <ScrollView
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
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <AccountField
                label="From"
                options={sources}
                value={value}
                onChange={(id) => {
                  onChange(id);
                  if (id === getValues("toId")) {
                    setValue("toId", "", { shouldValidate: true });
                  }
                }}
                getBalance={accounts.getBalance}
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
            rules={{ required: true, validate: (v, values) => v !== values.fromId }}
            render={({ field: { value, onChange } }) => (
              <AccountField
                label="To"
                options={destinations}
                value={value}
                onChange={(id) => {
                  onChange(id);
                  if (isCreditAccount(id)) {
                    setValue("income", "", { shouldValidate: true });
                  }
                }}
                getBalance={accounts.getBalance}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="amount"
          rules={{
            validate: (v) => {
              const n = parseFloat(v);
              return (!isNaN(n) && n >= 0.01) || "Must be ≥ 0.01";
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
              error={value === "" ? undefined : fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="fee"
          rules={{ validate: validateOptionalAmount }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Transfer fee (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional, deducted from From"
              error={fieldState.error?.message}
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
              rules={{ validate: validateOptionalAmount }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Amount earned (₱)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  error={fieldState.error?.message}
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
              render={({ field: { value, onChange } }) => (
                <AccountField
                  label="Deposit to"
                  options={sources}
                  value={value || toId}
                  onChange={onChange}
                  getBalance={accounts.getBalance}
                />
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
          label="Transfer"
          onPress={onSubmit}
          disabled={!isValid || sources.length === 0 || destinations.length === 0}
          loading={isSubmitting}
          className="mt-4"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
