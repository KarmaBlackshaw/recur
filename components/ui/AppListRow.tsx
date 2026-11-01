import React from "react";
import { TouchableOpacity, View, type TouchableOpacityProps } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

// Color is signal, never decoration: neutral by default, mint = money in, coral = late,
// indigo = card / loan / charged, muted = ended or de-emphasized.
export type RowTone = "neutral" | "positive" | "negative" | "accent" | "muted";

export const ICON_TONE: Record<RowTone, { tile: string; glyph: string }> = {
  neutral: { tile: "bg-white/[0.06]", glyph: colors.textSecondary },
  positive: { tile: "bg-paid/15", glyph: colors.paid },
  negative: { tile: "bg-overdue/15", glyph: colors.overdue },
  accent: { tile: "bg-secondary/15", glyph: colors.secondary },
  muted: { tile: "bg-white/[0.04]", glyph: colors.textMuted },
};

export const AMOUNT_TONE: Record<RowTone, string> = {
  neutral: "text-white",
  positive: "text-paid",
  negative: "text-overdue",
  accent: "text-secondary",
  muted: "text-textSecondary",
};

const CAPTION_TONE: Record<RowTone, string> = {
  neutral: "text-textSecondary",
  positive: "text-paid",
  negative: "text-overdue",
  accent: "text-secondary",
  muted: "text-textMuted",
};

interface AppListRowProps {
  icon: FeatherIconName;
  iconTone?: RowTone;
  title: string;
  meta?: string;
  metaIcon?: FeatherIconName;
  amount: string;
  amountTone?: RowTone;
  caption?: string;
  captionTone?: RowTone;
  accessory?: FeatherIconName;
  isMuted?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityActions?: TouchableOpacityProps["accessibilityActions"];
  onAccessibilityAction?: TouchableOpacityProps["onAccessibilityAction"];
}

// The one money row: icon tile · title over meta · amount over caption. Full-bleed, no card,
// 56dp tall. Opaque so a swipeable parent keeps its actions hidden until revealed.
export function AppListRow({
  icon,
  iconTone = "neutral",
  title,
  meta,
  metaIcon,
  amount,
  amountTone = "neutral",
  caption,
  captionTone = "neutral",
  accessory,
  isMuted = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: AppListRowProps) {
  const tile = ICON_TONE[isMuted ? "muted" : iconTone];

  const body = (
    <View className="flex-row items-center gap-3 py-2 min-h-[56px] bg-background px-5">
      <View className={`w-[36px] h-[36px] rounded-xl items-center justify-center ${tile.tile}`}>
        <Feather name={icon} size={17} color={tile.glyph} />
      </View>
      <View className="flex-1">
        <AppText
          variant="body-bold"
          className={`text-[14px] ${isMuted ? "text-textMuted" : ""}`}
          numberOfLines={1}
        >
          {title}
        </AppText>
        {meta || metaIcon ? (
          <View className="flex-row items-center gap-1">
            {metaIcon ? <Feather name={metaIcon} size={10} color={colors.secondary} /> : null}
            {meta ? (
              <AppText variant="meta" className={`shrink ${isMuted ? "text-textMuted" : ""}`} numberOfLines={1}>
                {meta}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      <View className="items-end">
        <AppText
          variant="amount"
          className={`text-[16px] ${AMOUNT_TONE[isMuted ? "muted" : amountTone]}`}
          numberOfLines={1}
        >
          {amount}
        </AppText>
        {caption ? (
          <AppText variant="meta" className={CAPTION_TONE[isMuted ? "muted" : captionTone]} numberOfLines={1}>
            {caption}
          </AppText>
        ) : null}
      </View>
      {accessory ? <Feather name={accessory} size={16} color={colors.textMuted} /> : null}
    </View>
  );

  return !onPress ? (
    <View accessible accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  ) : (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      {body}
    </TouchableOpacity>
  );
}
