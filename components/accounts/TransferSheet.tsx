import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { useAccounts } from "@/context/AccountContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { Account } from "@/types";

export interface TransferSheetRef {
  present: (opts?: { amount?: number }) => void;
}

interface TransferFormValues {
  fromId: string;
  toId: string;
  amount: string;
  note: string;
}

interface ChipsProps {
  label: string;
  options: Account[];
  value: string;
  onChange: (id: string) => void;
  getBalance: (id: string) => number;
}

function AccountChips({ label, options, value, onChange, getBalance }: ChipsProps) {
  return (
    <View className="mb-2">
      <AppLabel>{label}</AppLabel>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const isSelected = option.id === value;
          return (
            <TouchableOpacity
              key={option.id}
              className={`min-h-[44px] px-4 rounded-full justify-center border ${
                isSelected ? "bg-primary border-primary" : "bg-white/[0.04] border-border"
              }`}
              onPress={() => onChange(option.id)}
              accessibilityRole="radio"
              accessibilityLabel={`${option.name}, ${formatAmount(getBalance(option.id))}`}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
            >
              <AppText
                variant={isSelected ? "body-bold" : "body-medium"}
                className={`text-sm ${isSelected ? "text-white" : "text-textSecondary"}`}
                numberOfLines={1}
              >
                {option.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const TransferSheet = forwardRef<TransferSheetRef, { account: Account }>(
  function TransferSheet({ account }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const accounts = useAccounts();
    const sources = accounts.accounts.filter((a) => a.type !== "credit");
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
      defaultValues: { fromId: "", toId: "", amount: "", note: "" },
    });
    const fromId = watch("fromId");
    const destinations = accounts.accounts.filter((a) => a.id !== fromId);

    useImperativeHandle(ref, () => ({
      present: (opts) => {
        const isSource = account.type !== "credit";
        const from = isSource ? account.id : sources[0]?.id ?? "";
        const to = isSource ? accounts.accounts.find((a) => a.id !== account.id)?.id ?? "" : account.id;
        const amount = opts?.amount != null ? opts.amount.toFixed(2) : "";
        reset({ fromId: from, toId: to, amount, note: "" }, { keepDefaultValues: true });
        sheetRef.current?.present();
      },
    }));

    const onSubmit = handleSubmit(async (data) => {
      try {
        await accounts.transfer(data.fromId, data.toId, parseFloat(data.amount), data.note.trim() || undefined);
        sheetRef.current?.dismiss();
      } catch (e) {
        console.error("Transfer failed", e);
        Alert.alert("Transfer failed", "Something went wrong. Please try again.");
      }
    });

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["85%"]}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
        backdropComponent={renderBackdrop}
      >
        <View className="flex-row items-center justify-between px-5 mb-2">
          <AppText variant="title" accessibilityRole="header">Transfer</AppText>
          <TouchableOpacity
            className="w-11 h-11 items-center justify-center"
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView keyboardShouldPersistTaps="handled">
          <View className="px-5 pb-16">
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
                  <AccountChips
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
            <Controller
              control={control}
              name="toId"
              rules={{ required: true, validate: (v, values) => v !== values.fromId }}
              render={({ field: { value, onChange } }) => (
                <AccountChips
                  label="To"
                  options={destinations}
                  value={value}
                  onChange={onChange}
                  getBalance={accounts.getBalance}
                />
              )}
            />
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
              disabled={!isValid || sources.length === 0}
              loading={isSubmitting}
              className="mt-4"
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);
