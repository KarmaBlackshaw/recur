import React, { useRef } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/context/AccountContext";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppButton } from "@/components/ui/AppButton";
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
  note: string;
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
      <AppLabel>{label}</AppLabel>
      <TouchableOpacity
        className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-1"
        onPress={() => pickerRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${label}, ${selected.name}, ${formatAmount(getBalance(selected.id))}` : `${label}, choose account`}
      >
        <AppText
          variant="body-medium"
          className={`text-base ${selected ? "text-white" : "text-textMuted"}`}
          numberOfLines={1}
        >
          {selected?.name ?? "Choose account"}
        </AppText>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
      <AccountPickerSheet ref={pickerRef} title={label} options={options} value={value} onChange={onChange} />
    </>
  );
}

export default function TransferScreen() {
  const { accountId, amount } = useLocalSearchParams<{ accountId?: string; amount?: string }>();
  const accounts = useAccounts();
  const sources = accounts.accounts.filter((a) => a.type !== "credit");

  function toFormValues(): TransferFormValues {
    const account = accounts.accounts.find((a) => a.id === accountId);
    const isSource = account == null || account.type !== "credit";
    const from = isSource ? account?.id ?? sources[0]?.id ?? "" : sources[0]?.id ?? "";
    const to = isSource ? accounts.accounts.find((a) => a.id !== from)?.id ?? "" : account.id;
    return { fromId: from, toId: to, amount: amount ?? "", fee: "", note: "" };
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
  const destinations = accounts.accounts.filter((a) => a.id !== fromId);

  React.useEffect(() => {
    if (!accounts.isLoading) {
      reset(toFormValues());
    }
  }, [accounts.isLoading]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await accounts.transfer(
        data.fromId,
        data.toId,
        parseFloat(data.amount),
        data.note.trim() || undefined,
        data.fee === "" ? 0 : parseFloat(data.fee)
      );
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
                onChange={onChange}
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
          rules={{
            validate: (v) => {
              if (v === "") {
                return true;
              }
              const n = parseFloat(v);
              return (!isNaN(n) && n >= 0) || "Must be ≥ 0";
            },
          }}
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
