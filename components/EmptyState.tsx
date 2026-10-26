import React from "react";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
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
}

export function EmptyState({
  onAdd,
  title = "No expenses yet",
  message = "Tap + to add your first recurring expense",
  icon = "credit-card",
  actionLabel = "Add expense",
}: Props) {
  return (
    <View className="flex-1 items-center justify-center pt-20 px-8 gap-3">
      <Feather name={icon} size={64} color={colors.textMuted} />
      <AppText variant="body-bold" className="text-textSecondary text-lg">{title}</AppText>
      <AppText variant="meta" className="text-textMuted text-sm text-center">{message}</AppText>
      {onAdd && <AppButton label={actionLabel} variant="tonal" onPress={onAdd} className="mt-2 px-6" />}
    </View>
  );
}
