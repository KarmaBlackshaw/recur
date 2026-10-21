import React, { useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Feather } from "@expo/vector-icons";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppDisclosureCard } from "@/components/ui/AppDisclosureCard";
import { AccountCard } from "@/components/accounts/AccountCard";
import { CardColorPicker, CardIconPicker, CardLogoPicker, CardTemplatePicker } from "@/components/accounts/CardStylePickers";
import { DEFAULT_CARD_COLOR } from "@/constants/cardColors";
import { findBank, type BankId } from "@/constants/banks";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { netInterestPerPeriod } from "@/utils/interest";
import { ACCOUNT_TYPE_LABEL, type Account, type AccountInput, type AccountType, type InterestPeriod, type IoniconName } from "@/types";

interface AccountFormValues {
  name: string;
  type: AccountType;
  openingBalance: string;
  interestRate: string;
  interestPeriod: InterestPeriod;
  taxRate: string;
  creditLimit: string;
  statementDay: string;
  dueDay: string;
  color: string;
  icon: IoniconName;
  logoUri: string | null;
  bank: BankId | null;
}

type CardStyleTab = "custom" | "template";

const CARD_STYLE_TABS: { label: string; value: CardStyleTab }[] = [
  { label: "Custom", value: "custom" },
  { label: "Template", value: "template" },
];

const DEFAULT_ICON: Record<AccountType, IoniconName> = {
  debit: "wallet-outline",
  credit: "card-outline",
  cash: "cash-outline",
};

const TYPE_OPTIONS = (["debit", "credit", "cash"] as const).map((value) => ({
  label: ACCOUNT_TYPE_LABEL[value],
  value,
}));

const PERIOD_OPTIONS: { label: string; value: InterestPeriod }[] = [
  { label: "Daily", value: "daily" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const SAMPLE_BALANCE = 10000;

const PERIOD_UNIT: Record<InterestPeriod, string> = { daily: "day", monthly: "month", yearly: "year" };

function formatInterestSummary(rate: string, period: InterestPeriod) {
  const n = toNumber(rate);
  if (n == null) {
    return "Off";
  }
  if (isNaN(n)) {
    return "Invalid rate";
  }
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label;
  return `${n}% · ${periodLabel}`;
}

function toText(value: number | null | undefined) {
  return value != null ? value.toString() : "";
}

function toNumber(text: string) {
  return text.trim() === "" ? null : parseFloat(text);
}

function validatePercent(v: string) {
  if (v.trim() === "") {
    return true;
  }
  const n = parseFloat(v);
  return (!isNaN(n) && n <= 100) || "Must be 0–100";
}

function validateOptionalAmount(v: string) {
  return v.trim() === "" || !isNaN(parseFloat(v)) || "Enter an amount";
}

function validateDay(v: string) {
  if (v.trim() === "") {
    return true;
  }
  const n = parseInt(v, 10);
  return (!isNaN(n) && n >= 1 && n <= 31) || "Must be 1–31";
}

function validateRequiredDay(v: string): true | string {
  if (v.trim() === "") {
    return "Required";
  }
  return validateDay(v);
}

function toFormValues(account: Account | undefined): AccountFormValues {
  return {
    name: account?.name ?? "",
    type: account?.type ?? "debit",
    openingBalance: "",
    interestRate: toText(account?.interestRate),
    interestPeriod: account?.interestPeriod ?? "daily",
    taxRate: toText(account?.taxRate ?? (account ? null : 20)),
    creditLimit: toText(account?.creditLimit),
    statementDay: toText(account?.statementDay),
    dueDay: toText(account?.dueDay),
    color: account?.color ?? DEFAULT_CARD_COLOR,
    icon: account?.icon ?? DEFAULT_ICON[account?.type ?? "debit"],
    logoUri: account?.logoUri ?? null,
    bank: account?.bank ?? null,
  };
}

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accounts = useAccounts();
  const expenses = useExpenses();
  const editingAccount = id ? accounts.accounts.find((a) => a.id === id) : undefined;
  const isEditing = editingAccount != null;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getFieldState,
    formState: { isValid, isSubmitting, errors },
  } = useForm<AccountFormValues>({ mode: "onChange", defaultValues: toFormValues(editingAccount) });

  const [isInterestOpen, setIsInterestOpen] = useState(editingAccount?.interestRate != null);
  const [styleTab, setStyleTab] = useState<CardStyleTab>(editingAccount?.bank ? "template" : "custom");
  const type = watch("type");
  const hasInterest = type === "debit" && toNumber(watch("interestRate")) != null;
  const values = watch();
  const openingBalance = toNumber(values.openingBalance);
  const previewAccount: Account = {
    id: editingAccount?.id ?? "preview",
    name: values.name.trim() || "Account name",
    type,
    sortOrder: 0,
    interestRate: hasInterest ? toNumber(values.interestRate) : null,
    interestPeriod: values.interestPeriod,
    taxRate: null,
    interestAccruedThrough: null,
    creditLimit: type === "credit" ? toNumber(values.creditLimit) : null,
    statementDay: null,
    dueDay: type === "credit" ? toNumber(values.dueDay) : null,
    color: values.color,
    icon: values.icon,
    ...cardStyle(values.logoUri, values.bank),
    createdAt: "",
  };
  const hasInterestError = hasInterest && (errors.interestRate != null || errors.taxRate != null);
  const interestSummary = formatInterestSummary(values.interestRate, values.interestPeriod);
  const interestSummaryClassName = hasInterestError ? "text-overdue" : hasInterest ? "text-secondary" : "text-textMuted";
  const previewBalance = editingAccount
    ? accounts.getBalance(editingAccount.id)
    : openingBalance != null && !isNaN(openingBalance) ? openingBalance : 0;
  const sampleBalance = previewBalance > 0 ? previewBalance : SAMPLE_BALANCE;
  const sampleInterest =
    hasInterest && !hasInterestError
      ? netInterestPerPeriod(
          sampleBalance,
          toNumber(values.interestRate) ?? 0,
          toNumber(values.taxRate) ?? 0,
          values.interestPeriod
        )
      : null;

  function cardStyle(logoUri: string | null, bank: BankId | null) {
    return styleTab === "template" && bank ? { logoUri: null, bank } : { logoUri, bank: null };
  }

  function selectTemplate(bank: BankId | null, onChange: (value: BankId | null) => void) {
    onChange(bank);
    const template = findBank(bank);
    if (template) {
      setValue("color", template.color, { shouldDirty: true });
    }
  }

  function changeType(next: AccountType, onChange: (value: AccountType) => void) {
    onChange(next);
    if (!getFieldState("icon").isDirty) {
      setValue("icon", DEFAULT_ICON[next]);
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    const isDebit = data.type === "debit";
    const earnsInterest = isDebit && toNumber(data.interestRate) != null;
    const isCredit = data.type === "credit";
    const input: AccountInput = {
      name: data.name.trim(),
      type: data.type,
      interestRate: earnsInterest ? toNumber(data.interestRate) : null,
      interestPeriod: earnsInterest ? data.interestPeriod : null,
      taxRate: earnsInterest ? toNumber(data.taxRate) : null,
      creditLimit: isCredit ? toNumber(data.creditLimit) : null,
      statementDay: isCredit ? toNumber(data.statementDay) : null,
      dueDay: isCredit ? toNumber(data.dueDay) : null,
      color: data.color,
      icon: data.icon,
      ...cardStyle(data.logoUri, data.bank),
    };
    try {
      if (editingAccount) {
        await accounts.updateAccount(editingAccount.id, input);
      } else {
        await accounts.addAccount(input, toNumber(data.openingBalance) ?? 0);
      }
      router.back();
    } catch (e) {
      console.error("Save account failed", e);
      Alert.alert("Save failed", "Something went wrong. Please try again.");
    }
  });

  function confirmDelete() {
    if (!editingAccount) {
      return;
    }
    const loanTransactions = accounts.transactions.filter((t) => t.accountId === editingAccount.id && t.loanId != null);
    const repaymentCount = loanTransactions.filter((t) => t.kind === "loan_in").length;
    const lentCount = loanTransactions.filter((t) => t.kind === "loan_out").length;
    const loanNotes = [
      repaymentCount > 0
        ? `${repaymentCount} loan ${repaymentCount === 1 ? "repayment" : "repayments"} recorded here will be removed, so those loans will show more owed.`
        : "",
      lentCount > 0
        ? `${lentCount} ${lentCount === 1 ? "loan was" : "loans were"} lent from this account; ${lentCount === 1 ? "it'll" : "they'll"} show “Deleted account”.`
        : "",
    ].filter((note) => note !== "");
    const loanNote = loanNotes.length > 0 ? `\n\n${loanNotes.join(" ")}` : "";
    Alert.alert(
      `Delete ${editingAccount.name}?`,
      `Its transactions are removed. Expenses paid from it keep their history but no longer charge an account.${loanNote}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await accounts.deleteAccount(editingAccount.id);
              await expenses.reloadAll();
              router.dismissTo("/accounts");
            } catch (e) {
              console.error("Delete account failed", e);
              Alert.alert("Delete failed", "Something went wrong. Please try again.");
            }
          },
        },
      ]
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
        <AppText variant="title" className="flex-1 text-center" numberOfLines={1}>
          {isEditing ? "Edit Account" : "Add Account"}
        </AppText>
        <View className="w-11" />
      </View>

      <ScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row px-10 mb-5">
          <AccountCard account={previewAccount} previewBalance={previewBalance} />
        </View>

        <Controller
          control={control}
          name="name"
          rules={{ validate: (v) => v.trim() !== "" || "Name is required" }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              autoFocus={!isEditing}
              label="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. BPI Savings"
              maxLength={40}
              error={fieldState.error?.message}
            />
          )}
        />

        {isEditing ? (
          <AppText variant="meta" className="mt-1 mb-2">
            {ACCOUNT_TYPE_LABEL[type]}. Type can't change after creation.
          </AppText>
        ) : (
          <Controller
            control={control}
            name="type"
            render={({ field: { value, onChange } }) => (
              <AppRadioGroup label="Type" options={TYPE_OPTIONS} value={value} onChange={(next) => changeType(next, onChange)} />
            )}
          />
        )}

        {!isEditing && (
          <Controller
            control={control}
            name="openingBalance"
            rules={{ validate: validateOptionalAmount }}
            render={({ field: { value, onChange, onBlur }, fieldState }) => (
              <AppTextInput
                label={type === "credit" ? "Currently owed (₱)" : "Opening balance (₱)"}
                isAmount
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="0.00"
                error={fieldState.error?.message}
              />
            )}
          />
        )}

        {type === "debit" && (
          <AppDisclosureCard
            title="Interest"
            description="Track interest credited and tax withheld"
            summary={interestSummary}
            summaryClassName={interestSummaryClassName}
            isOpen={isInterestOpen}
            onToggle={setIsInterestOpen}
          >
            <Controller
              control={control}
              name="interestRate"
              rules={{ validate: validatePercent }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Interest rate (% per year)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0"
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="interestPeriod"
              render={({ field: { value, onChange } }) => (
                <AppRadioGroup label="Credited" options={PERIOD_OPTIONS} value={value} onChange={onChange} />
              )}
            />
            <Controller
              control={control}
              name="taxRate"
              rules={{ validate: validatePercent }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Tax withheld (% of interest)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="20"
                  error={fieldState.error?.message}
                />
              )}
            />
            {sampleInterest != null && (
              <AppText variant="meta" className="mt-3">
                ≈ {formatAmount(sampleInterest)}/{PERIOD_UNIT[values.interestPeriod]} on {formatAmount(sampleBalance)} after tax
              </AppText>
            )}
          </AppDisclosureCard>
        )}

        {type === "credit" && (
          <>
            <Controller
              control={control}
              name="creditLimit"
              rules={{ validate: validateOptionalAmount }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Credit limit (₱)"
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
              name="statementDay"
              rules={{ validate: validateRequiredDay }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Cut-off day (1–31)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="1"
                  keyboardType="number-pad"
                  maxLength={2}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="dueDay"
              rules={{ validate: validateRequiredDay }}
              render={({ field: { value, onChange, onBlur }, fieldState }) => (
                <AppTextInput
                  label="Due day (1–31)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="1"
                  keyboardType="number-pad"
                  maxLength={2}
                  error={fieldState.error?.message}
                />
              )}
            />
          </>
        )}

        <AppTabs tabs={CARD_STYLE_TABS} value={styleTab} onChange={setStyleTab} className="mt-4 mb-4" />
        {styleTab === "custom" ? (
          <>
            <Controller
              control={control}
              name="color"
              render={({ field: { value, onChange } }) => <CardColorPicker value={value} onChange={onChange} />}
            />
            <Controller
              control={control}
              name="icon"
              render={({ field: { value, onChange } }) => <CardIconPicker value={value} onChange={onChange} />}
            />
            <Controller
              control={control}
              name="logoUri"
              render={({ field: { value, onChange } }) => <CardLogoPicker value={value} onChange={onChange} />}
            />
          </>
        ) : (
          <Controller
            control={control}
            name="bank"
            render={({ field: { value, onChange } }) => (
              <CardTemplatePicker value={value} onChange={(bank) => selectTemplate(bank, onChange)} />
            )}
          />
        )}

        <AppButton
          label={isEditing ? "Save Changes" : "Save Account"}
          onPress={onSubmit}
          disabled={!isValid}
          loading={isSubmitting}
          className="mt-4"
        />
        {!isValid && (
          <AppText variant="meta" className="text-center mt-2">Fill in the required fields to save</AppText>
        )}

        {isEditing && (
          <AppButton label="Delete Account" variant="destructive" onPress={confirmDelete} className="mt-3" />
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
