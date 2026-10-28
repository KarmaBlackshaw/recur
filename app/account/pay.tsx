import React, { useEffect, useRef } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import Feather from "@expo/vector-icons/Feather";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAccounts } from "@/context/AccountContext";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import type { Account } from "@/types";

interface PayCardFormValues {
  fromId: string;
  amount: string;
  fee: string;
  note: string;
}

function PayCardForm({ card, amount }: { card: Account; amount?: string }) {
  const sourceSheetRef = useRef<AccountPickerSheetRef>(null);
  const accounts = useAccounts();
  const sources = accounts.activeAccounts.filter((a) => a.type !== "credit");
  const {
    control,
    handleSubmit,
    trigger,
    formState: { isValid, isSubmitting },
  } = useForm<PayCardFormValues>({
    mode: "onChange",
    defaultValues: {
      fromId: sources[0]?.id ?? "",
      // A settled bill (₱0) has nothing to prefill; an invalid prefill would disable Pay silently
      amount: amount != null && parseFloat(amount) >= 0.01 ? amount : "",
      fee: "",
      note: "",
    },
  });

  // A prefilled bill amount the source can't cover would otherwise disable Pay without saying why
  useEffect(() => {
    trigger("amount");
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await accounts.transfer({
        fromId: data.fromId,
        toId: card.id,
        amount: parseFloat(data.amount),
        fee: data.fee === "" ? 0 : parseFloat(data.fee),
        income: 0,
        incomeCategory: "Other",
        incomeAccountId: card.id,
        note: data.note.trim() || null,
      });
      router.back();
    } catch (e) {
      console.error("Card payment failed", e);
      Alert.alert("Payment failed", e instanceof OverdraftError ? e.message : "Something went wrong. Please try again.");
    }
  });

  return (
    <>
      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row mb-4">
          <AccountCard account={card} isStatic />
        </View>

        <AppLabel>Pay from</AppLabel>
        <Controller
          control={control}
          name="fromId"
          rules={{ required: true, deps: "amount" }}
          render={({ field: { value } }) => {
            const source = sources.find((a) => a.id === value);
            return (
              <TouchableOpacity
                className="bg-surface border border-border rounded-[10px] px-4 py-4 flex-row items-center justify-between mb-3"
                onPress={() => sourceSheetRef.current?.present()}
                accessibilityRole="button"
                accessibilityLabel={
                  source
                    ? `Pay from, ${source.name}, ${formatAmount(accounts.getBalance(source.id))}`
                    : "Pay from, choose account"
                }
              >
                <AppText
                  variant="body-medium"
                  className={`text-base ${source ? "text-white" : "text-textMuted"}`}
                  numberOfLines={1}
                >
                  {source?.name ?? "Choose account"}
                </AppText>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />

        <Controller
          control={control}
          name="amount"
          rules={{
            validate: (v, values) => {
              const n = parseFloat(v);
              if (isNaN(n) || n < 0.01) {
                return "Must be ≥ 0.01";
              }
              const fee = values.fee === "" ? 0 : parseFloat(values.fee) || 0;
              return accounts.overdraftError([{ accountId: values.fromId, amount: -(n + fee) }])?.message ?? true;
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
            deps: "amount",
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
              label="Payment fee (₱)"
              isAmount
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional, charged on top"
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

        <AppButton label="Pay bill" onPress={onSubmit} disabled={!isValid} loading={isSubmitting} className="mt-4" />
      </AppFormScrollView>

      <Controller
        control={control}
        name="fromId"
        render={({ field: { value, onChange } }) => (
          <AccountPickerSheet ref={sourceSheetRef} options={sources} value={value} onChange={onChange} />
        )}
      />
    </>
  );
}

export default function PayCardScreen() {
  const { id, amount } = useLocalSearchParams<{ id: string; amount?: string }>();
  const accounts = useAccounts();
  const card = accounts.accounts.find((a) => a.id === id);

  if (accounts.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!card || card.type !== "credit" || card.archivedAt != null) {
    const isArchivedCard = card?.type === "credit" && card.archivedAt != null;
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">
          {isArchivedCard ? "This card is archived." : "This card no longer exists."}
        </AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
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
        <View className="flex-1 items-center">
          <AppText variant="title" numberOfLines={1}>Pay bill</AppText>
          <AppText variant="meta" numberOfLines={1}>{card.name}</AppText>
        </View>
        <View className="w-11" />
      </View>

      <PayCardForm card={card} amount={amount} />
    </SafeAreaView>
  );
}
