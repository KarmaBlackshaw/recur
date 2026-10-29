import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

interface Props {
  onAdd?: () => void;
  title?: string;
  message?: string;
  icon?: FeatherIconName;
  actionLabel?: string;
  // A quieter second way in, shown as a text button under the main action.
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  onAdd,
  title = "No recurring bills yet",
  message = "Add rent, subscriptions and other bills you pay every month. Recur shows what's due.",
  icon = "credit-card",
  actionLabel = "Add a recurring bill",
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View className="flex-1 items-center justify-center pt-20 px-8 gap-3">
      <Feather name={icon} size={64} color={colors.textMuted} />
      <AppText variant="body-bold" className="text-textSecondary text-lg text-center">{title}</AppText>
      <AppText variant="meta" className="text-textMuted text-sm text-center">{message}</AppText>
      {onAdd && <AppButton label={actionLabel} variant="tonal" onPress={onAdd} className="mt-2 px-6" />}
      {secondaryLabel && onSecondary ? (
        <TouchableOpacity
          onPress={onSecondary}
          className="min-h-[44px] justify-center px-4"
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
        >
          <AppText variant="body-bold" className="text-sm text-secondary">{secondaryLabel}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
