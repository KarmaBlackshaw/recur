import React, { useEffect } from "react";
import { View, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { AppText } from "../../components/ui/AppText";
import { useExpenses } from "../../context/ExpenseContext";
import * as preferencesDB from "../../db/preferences";
import { colors } from "../../constants/theme";

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
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity className="p-1" onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Profile
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          Profile
        </AppText>

        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6 px-4 py-4">
          <AppText variant="label" className="text-white/40 mb-2">
            Your Name
          </AppText>

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
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontFamily: "Quicksand_500Medium",
                  marginBottom: 16,
                }}
              />
            )}
          />

          <TouchableOpacity
            className="rounded-xl items-center py-3"
            style={{
              backgroundColor:
                isDirty && isValid ? colors.primary : "rgba(255,255,255,0.1)",
            }}
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
