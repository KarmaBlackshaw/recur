import React from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

interface HeaderAction {
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  accessibilityHint?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  // A text action on the right, e.g. Save on long forms so it stays reachable above the keyboard.
  action?: HeaderAction;
  // Anything else for the right slot, e.g. an edit icon. Ignored when `action` is set.
  right?: React.ReactNode;
}

export function AppFormHeader({ title, subtitle, onBack = () => router.back(), action, right }: Props) {
  const isActionInactive = action != null && (action.isDisabled === true || action.isLoading === true);
  return (
    <View className="flex-row items-center px-3 pt-2 pb-3">
      <View className="w-16 items-start">
        <TouchableOpacity
          onPress={onBack}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
      </View>
      <View className="flex-1 items-center">
        <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="meta" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View className="w-16 items-end">
        {action ? (
          <TouchableOpacity
            onPress={action.onPress}
            disabled={isActionInactive}
            className={`min-w-[44px] h-11 px-2 items-center justify-center ${action.isDisabled ? "opacity-40" : ""}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.accessibilityHint}
            accessibilityState={{ disabled: isActionInactive, busy: action.isLoading === true }}
          >
            {action.isLoading ? (
              <ActivityIndicator color={colors.secondary} />
            ) : (
              <AppText variant="body-bold" className="text-[15px] text-secondary">
                {action.label}
              </AppText>
            )}
          </TouchableOpacity>
        ) : (
          right
        )}
      </View>
    </View>
  );
}
