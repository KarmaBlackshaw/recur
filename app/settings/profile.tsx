import React, { useEffect } from "react";
import { View, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { useExpenses } from "@/context/ExpenseContext";
import * as preferencesDB from "@/db/preferences";

interface FormValues {
  name: string;
}

export default function ProfileScreen() {
  const { userName, setUserName } = useExpenses();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<FormValues>({
    defaultValues: { name: userName ?? "" },
  });

  useEffect(() => {
    reset({ name: userName ?? "" });
  }, [userName, reset]);

  async function onSave(values: FormValues) {
    const trimmed = values.name.trim();
    if (trimmed) {
      await preferencesDB.setPreference("user_name", trimmed);
    } else {
      await preferencesDB.deletePreference("user_name");
    }
    setUserName(trimmed || null);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title="Profile" />

      <ScrollView
        contentContainerClassName="px-4 pb-10"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppLabel className="pl-1">
          Profile
        </AppLabel>

        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6 px-4 py-4">
          <AppLabel>
            Your name
          </AppLabel>

          <Controller
            control={control}
            name="name"
            rules={{ maxLength: 40 }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={40}
                autoCapitalize="words"
                returnKeyType="done"
                className="bg-white/[0.07] rounded-[10px] px-[14px] py-[12px] text-white text-[15px] font-quicksand-medium mb-[16px]"
              />
            )}
          />

          <TouchableOpacity
            className={`rounded-xl items-center py-3 ${isDirty && isValid ? "bg-primary" : "bg-white/10"}`}
            onPress={handleSubmit(onSave)}
            disabled={!isDirty || !isValid}
          >
            <AppText variant="body-medium" className="text-white text-[15px]">
              Save
            </AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
