import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

interface Props {
  label: string;
  value: string;
  // Shown muted when `value` is empty.
  placeholder?: string;
  icon?: FeatherIconName;
  onPress: () => void;
  caption?: string;
  error?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

// A form row that opens a picker (sheet, calendar, list). Same frame as AppTextInput.
export function AppSelectField({
  label,
  value,
  placeholder,
  icon = "chevron-right",
  onPress,
  caption,
  error,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const isEmpty = value === "";
  return (
    <View>
      <AppLabel>{label}</AppLabel>
      <TouchableOpacity
        className={`bg-surface border rounded-[10px] px-4 py-4 flex-row items-center justify-between gap-3 mb-1 ${error ? "border-overdue" : "border-border"}`}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}, ${isEmpty ? placeholder ?? "not set" : value}`}
        accessibilityHint={error ?? accessibilityHint}
      >
        <AppText
          variant="body-medium"
          className={`shrink text-base ${isEmpty ? "text-textMuted" : "text-white"}`}
          numberOfLines={1}
        >
          {isEmpty ? placeholder : value}
        </AppText>
        <Feather name={icon} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? (
        <View className="flex-row items-center gap-1.5 mb-1" accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={12} color={colors.overdue} />
          <AppText variant="meta" className="text-overdue">{error}</AppText>
        </View>
      ) : caption ? (
        <AppText variant="caption" className="px-1 mb-2">{caption}</AppText>
      ) : null}
    </View>
  );
}
