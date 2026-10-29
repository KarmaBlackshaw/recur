import React from "react";
import { TouchableOpacity, View, type TouchableOpacityProps } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

// Color is signal, never decoration: neutral by default, mint = money in, coral = late,
// indigo = card / loan / charged, muted = ended or de-emphasized.
export type RowTone = "neutral" | "positive" | "negative" | "accent" | "muted";

const ICON_TONE: Record<RowTone, { tile: string; glyph: string }> = {
  neutral: { tile: "bg-white/[0.06]", glyph: colors.textSecondary },
  positive: { tile: "bg-paid/15", glyph: colors.paid },
  negative: { tile: "bg-overdue/15", glyph: colors.overdue },
  accent: { tile: "bg-secondary/15", glyph: colors.secondary },
  muted: { tile: "bg-white/[0.04]", glyph: colors.textMuted },
};

const AMOUNT_TONE: Record<RowTone, string> = {
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

const ACCESSORY_COLOR: Record<RowTone, string> = {
  neutral: colors.textMuted,
  positive: colors.paid,
  negative: colors.overdue,
  accent: colors.secondary,
  muted: colors.textMuted,
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
  // Makes the accessory its own 44dp button (e.g. the pay circle). Without it the accessory is decoration.
  onAccessoryPress?: () => void;
  onAccessoryLongPress?: () => void;
  accessoryLabel?: string;
  accessoryTone?: RowTone;
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
  onAccessoryPress,
  onAccessoryLongPress,
  accessoryLabel,
  accessoryTone = "neutral",
  isMuted = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: AppListRowProps) {
  const tile = ICON_TONE[isMuted ? "muted" : iconTone];
  const hasAccessoryButton = accessory != null && onAccessoryPress != null;

  // With an accessory button the row leaves its right gutter to the button, so the button can sit beside the
  // row's own touch target instead of inside it (a nested button is invisible to screen readers).
  const body = (
    <View className={`flex-row items-center gap-3 py-2 min-h-[56px] bg-background ${hasAccessoryButton ? "pl-5 pr-1" : "px-5"}`}>
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
      {accessory && !hasAccessoryButton ? <Feather name={accessory} size={16} color={colors.textMuted} /> : null}
    </View>
  );

  const row = !onPress ? (
    <View accessible accessibilityLabel={accessibilityLabel} className={hasAccessoryButton ? "flex-1" : undefined}>
      {body}
    </View>
  ) : (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={hasAccessoryButton ? "flex-1" : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      {body}
    </TouchableOpacity>
  );

  if (!hasAccessoryButton || !accessory) {
    return row;
  }

  return (
    <View className="flex-row items-center bg-background pr-3">
      {row}
      <TouchableOpacity
        onPress={onAccessoryPress}
        onLongPress={onAccessoryLongPress}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={accessoryLabel}
      >
        <Feather name={accessory} size={22} color={ACCESSORY_COLOR[accessoryTone]} />
      </TouchableOpacity>
    </View>
  );
}
