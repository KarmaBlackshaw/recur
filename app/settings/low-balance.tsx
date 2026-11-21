import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Controller } from "react-hook-form";
import { useAppForm } from "@/utils/useAppForm";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFormScrollView } from "@/components/ui/AppFormScrollView";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { LoadingState } from "@/components/ui/LoadingState";
import { PREF_LOW_BALANCE_THRESHOLD } from "@/constants/preferences";
import { deletePreference, getPreference, setPreference } from "@/db/preferences";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { validateOptionalAmount } from "@/utils/accounts/validateOptionalAmount";
import { parseThreshold } from "@/utils/forecast/useLowBalanceThreshold";
import { useDiscardGuard } from "@/utils/useDiscardGuard";
import { useMount } from "@/utils/useMount";

interface FormValues {
  threshold: string;
}

export default function LowBalanceScreen() {
  const [isLoaded, setIsLoaded] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid, isSubmitting, isDirty },
  } = useAppForm<FormValues>({ mode: "onChange", defaultValues: { threshold: "" } });
  const { allowLeave } = useDiscardGuard(isDirty);

  useMount(async () => {
    try {
      const saved = parseThreshold(await getPreference(PREF_LOW_BALANCE_THRESHOLD));
      reset({ threshold: saved == null ? "" : String(saved) });
    } catch (e) {
      console.error("Reading the low-balance threshold failed", e);
    }
    setIsLoaded(true);
  });

  const onSubmit = handleSubmit(async ({ threshold }) => {
    try {
      if (threshold === "") {
        await deletePreference(PREF_LOW_BALANCE_THRESHOLD);
      } else {
        await setPreference(PREF_LOW_BALANCE_THRESHOLD, String(parseFloat(threshold)));
      }
      allowLeave();
      router.back();
    } catch (e) {
      console.error("Saving the low-balance threshold failed", e);
      alertFailure("Save failed", e);
    }
  });

  if (!isLoaded) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title="Low balance warning" />

      <AppFormScrollView
        contentContainerClassName="px-5 pb-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="threshold"
          rules={{ validate: validateOptionalAmount }}
          render={({ field: { value, onChange, onBlur }, fieldState }) => {
            const error = fieldState.isTouched ? fieldState.error?.message : undefined;
            return (
              <>
                <AppTextInput
                  label="Warn below (₱)"
                  isAmount
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  error={error}
                />
                {!error && (
                  <AppText variant="caption" className="px-1 mb-2">
                    The forecast warns when your accounts would drop below this. Leave it empty to warn below ₱0. An
                    account can set its own on its edit page.
                  </AppText>
                )}
              </>
            );
          }}
        />

        <AppButton
          label="Save"
          onPress={onSubmit}
          disabled={!isDirty || !isValid}
          loading={isSubmitting}
          className="mt-4"
        />
      </AppFormScrollView>
    </SafeAreaView>
  );
}
