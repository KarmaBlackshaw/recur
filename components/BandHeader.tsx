import React from "react";
import { View, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import type { FeatherIconName } from "@/types";

interface Props {
  label: string;
  icon: FeatherIconName;
  accent: string;
  total?: number;
  count?: number;
  caption?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function BandHeader({ label, icon, accent, total, count, caption, isCollapsed = false, onToggle }: Props) {
  const heading = count != null ? `${label} · ${count}` : label;
  const title = caption ? `${heading}, ${caption}` : heading;
  const accessibilityLabel = total != null ? `${title}, ${formatAmount(total)}` : title;
  const content = (
    <>
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={14} color={accent} />
        <AppText variant="overline" style={{ color: accent }}>
          {heading}
        </AppText>
        {caption ? <AppText variant="meta">{caption}</AppText> : null}
      </View>
      <View className="flex-row items-center gap-2">
        {total != null ? <AppText variant="amount-sm">{formatAmount(total)}</AppText> : null}
        {onToggle ? (
          <Feather name={isCollapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.textMuted} />
        ) : null}
      </View>
    </>
  );

  if (onToggle) {
    return (
      <TouchableOpacity
        className="flex-row items-center justify-between px-5 pt-6 pb-2"
        activeOpacity={0.7}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={isCollapsed ? "Expands the section" : "Collapses the section"}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessible
      className="flex-row items-center justify-between px-5 pt-6 pb-2"
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </View>
  );
}
