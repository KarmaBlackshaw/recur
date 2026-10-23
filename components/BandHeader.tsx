import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { formatAmount } from "@/utils/dateHelpers";
import type { FeatherIconName } from "@/types";

interface Props {
  label: string;
  icon: FeatherIconName;
  accent: string;
  total?: number;
  count?: number;
  caption?: string;
}

export function BandHeader({ label, icon, accent, total, count, caption }: Props) {
  const heading = count != null ? `${label} · ${count}` : label;
  const title = caption ? `${heading}, ${caption}` : heading;
  return (
    <View
      accessible
      className="flex-row items-center justify-between px-5 pt-6 pb-2"
      accessibilityRole="header"
      accessibilityLabel={total != null ? `${title}, ${formatAmount(total)}` : title}
    >
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={14} color={accent} />
        <AppText variant="overline" style={{ color: accent }}>
          {heading}
        </AppText>
        {caption ? <AppText variant="meta">{caption}</AppText> : null}
      </View>
      {total != null ? <AppText variant="amount-sm">{formatAmount(total)}</AppText> : null}
    </View>
  );
}
