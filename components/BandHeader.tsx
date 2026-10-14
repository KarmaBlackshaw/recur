import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "./ui/AppText";
import { formatAmount } from "../utils/dateHelpers";
import type { FeatherIconName } from "../types";

interface Props {
  label: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
  count?: number;
}

export function BandHeader({ label, icon, accent, total, count }: Props) {
  const title = count != null ? `${label} · ${count}` : label;
  return (
    <View
      accessible
      className="flex-row items-center justify-between px-5 pt-6 pb-2"
      accessibilityRole="header"
      accessibilityLabel={`${title}, ${formatAmount(total)}`}
    >
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={14} color={accent} />
        <AppText variant="overline" style={{ color: accent }}>
          {title}
        </AppText>
      </View>
      <AppText variant="amount-sm">{formatAmount(total)}</AppText>
    </View>
  );
}
