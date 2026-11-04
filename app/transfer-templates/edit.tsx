import React, { useState } from "react";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/context/AccountContext";
import { useTransferTemplates } from "@/context/TransferTemplateContext";
import { AccountField } from "@/components/AccountField";
import { AppButton } from "@/components/ui/AppButton";
import { AppDisclosureCard } from "@/components/ui/AppDisclosureCard";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { TRANSFER_CATEGORY } from "@/constants/categories";
import { colors } from "@/constants/theme";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { formatIncomeHint } from "@/utils/accounts/formatIncomeHint";
import { formatIncomeSummary } from "@/utils/accounts/formatIncomeSummary";
import { parseOptionalAmount } from "@/utils/accounts/parseOptionalAmount";
import { validateOptionalAmount } from "@/utils/accounts/validateOptionalAmount";
import type { TransferTemplateInput } from "@/types";

interface TemplateFormValues {
  name: string;
  fromId: string;
  toId: string;
  amount: string;
  fee: string;
  income: string;
  incomeAccountId: string; // "" = same as To
  note: string;
}

type EditParams = {
  id?: string;
  // Prefill from the Transfer form's "Save as template"
  fromId?: string;
  toId?: string;
  amount?: string;
  fee?: string;
  income?: string;
  incomeAccountId?: string;
  note?: string;
};

export default function TransferTemplateEditScreen() {
  const params = useLocalSearchParams<EditParams>();
  const { id } = params;
  const accounts = useAccounts();
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useTransferTemplates();
  const isEditing = id != null;
  const template = templates.find((t) => t.id === id);
  const sources = accounts.activeAccounts.filter((a) => a.type !== "credit");
  const isReady = !accounts.isLoading && !isLoading;
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCreditAccount = (targetId: string) => accounts.accounts.find((a) => a.id === targetId)?.type === "credit";

  // Ids that are no longer usable (archived, deleted, a credit card as From) come back empty so the user picks again.
  function toFormValues(): TemplateFormValues {
    const wantedFrom = template?.fromId ?? params.fromId ?? sources[0]?.id ?? "";
    const from = sources.some((a) => a.id === wantedFrom) ? wantedFrom : "";
    const wantedTo = template?.toId ?? params.toId ?? accounts.activeAccounts.find((a) => a.id !== from)?.id ?? "";
    const to = accounts.activeAccounts.some((a) => a.id === wantedTo) && wantedTo !== from ? wantedTo : "";
    const wantedIncomeTo = template ? template.incomeAccountId ?? "" : params.incomeAccountId ?? "";
    const wantedIncome = template ? (template.income > 0 ? String(template.income) : "") : params.income ?? "";
    const fee = template ? (template.fee > 0 ? String(template.fee) : "") : params.fee ?? "";
    return {
      name: template?.name ?? "",
      fromId: from,
      toId: to,
      amount: template ? String(template.amount) : params.amount ?? "",
      fee,
      income: isCreditAccount(to) ? "" : wantedIncome,
      incomeAccountId: sources.some((a) => a.id === wantedIncomeTo) ? wantedIncomeTo : "",
      note: template ? template.note ?? "" : params.note ?? "",
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
  } = useForm<TemplateFormValues>({
    mode: "onChange",
    defaultValues: toFormValues(),
  });
  const { allowLeave } = useDiscardGuard(isDirty);
  const fromId = watch("fromId");
  const toId = watch("toId");
  const destinations = accounts.activeAccounts.filter((a) => a.id !== fromId);
  const toAccount = accounts.accounts.find((a) => a.id === toId);
  const canEarnIncome = toAccount?.type !== "credit";
  const incomeValue = parseOptionalAmount(watch("income"));
  const incomeSummaryClassName = isNaN(incomeValue) ? "text-overdue" : incomeValue > 0 ? "text-secondary" : "text-textMuted";
  const incomeAccountId = watch("incomeAccountId") || toId;
  const incomeHint = toAccount && incomeAccountId === toId ? formatIncomeHint(toAccount.name, watch("amount"), incomeValue) : null;

  React.useEffect(() => {
    if (isReady) {
      const values = toFormValues();
      // A plain reset drops the field rules, so the trigger below would validate nothing
      reset(values, { keepFieldsRef: true });
      setIsIncomeOpen(values.income !== "");
      if (isEditing || params.amount) {
        trigger();
      }
    }
  }, [isReady]);

  const onSubmit = handleSubmit(async (data) => {
    const input: TransferTemplateInput = {
      name: data.name.trim(),
      fromId: data.fromId,
      toId: data.toId,
      amount: parseFloat(data.amount),
      fee: parseOptionalAmount(data.fee),
      income: parseOptionalAmount(data.income),
      incomeAccountId: data.incomeAccountId || null,
      note: data.note.trim() || null,
    };
    try {
      if (id != null) {
        await updateTemplate(id, input);
      } else {
        await addTemplate(input);
      }
      allowLeave();
      router.back();
    } catch (e) {
      console.error("Save template failed", e);
      alertFailure("Save failed", e);
    }
  });

  function confirmDelete() {
    if (id == null) {
      return;
    }
    const templateId = id;
    Alert.alert("Delete template?", "Transfers you made with it stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          // Keeps the form up while the screen closes, instead of flashing "no longer exists".
          setIsDeleting(true);
          try {
            await deleteTemplate(templateId);
            allowLeave();
            router.back();
          } catch (e) {
            setIsDeleting(false);
            console.error("Delete template failed", e);
            alertFailure("Delete failed", e);
          }
        },
      },
    ]);
  }

  if (isEditing && !isReady) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (isEditing && !template && !isDeleting) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">This template no longer exists.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title={isEditing ? "Edit template" : "New template"} />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="name"
          rules={{
            validate: (v) => {
              const trimmed = v.trim();
              if (trimmed === "") {
                return "Enter a name";
              }
              const isTaken = templates.some((t) => t.id !== id && t.name.toLowerCase() === trimmed.toLowerCase());
              return isTaken ? "A template with this name exists" : true;
            },
          }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => (
            <AppTextInput
              label="Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Cash in 500"
              maxLength={30}
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
            />
          )}
        />
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
            rules={{ required: true, validate: (v, values) => v !== values.fromId }}
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
            validate: (v) => {
              if (v.trim() === "") {
                return "Enter an amount";
              }
              const n = parseFloat(v);
              return isNaN(n) || n < 0.01 ? "Must be ≥ 0.01" : true;
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
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
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
              error={fieldState.isTouched ? fieldState.error?.message : undefined}
            />
          )}
        />
        {canEarnIncome && (
          <AppDisclosureCard
            title="Income"
            description="Earned on this transfer, like a cash-out fee"
            summary={formatIncomeSummary(incomeValue)}
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
                  error={fieldState.isTouched ? fieldState.error?.message : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="incomeAccountId"
              render={({ field: { value, onChange } }) => (
                <AccountField label="Deposit to" options={sources} value={value || toId} onChange={onChange} />
              )}
            />
            <AppText variant="meta" className="mt-3">
              {`Saved as ${TRANSFER_CATEGORY} income`}
            </AppText>
            {incomeHint && (
              <AppText variant="meta" className="mt-1">
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
          label="Save template"
          onPress={onSubmit}
          disabled={!isValid || sources.length === 0 || destinations.length === 0}
          loading={isSubmitting}
          className="mt-4"
        />
        {isEditing && (
          <AppButton label="Delete template" variant="destructive" onPress={confirmDelete} className="mt-3" />
        )}
      </AppFormScrollView>
    </SafeAreaView>
  );
}
