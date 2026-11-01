import React from "react";
import { View, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppHeroAmount } from "@/components/ui/AppHeroAmount";
import type { RowTone } from "@/components/ui/AppListRow";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

export type ActivityHeroTone = "primary" | "secondary" | "paid" | "neutral";

const TONE: Record<ActivityHeroTone, { box: string; amount: RowTone }> = {
  primary: { box: "bg-primary/10 border-primary/20", amount: "accent" },
  secondary: { box: "bg-secondary/10 border-secondary/20", amount: "accent" },
  paid: { box: "bg-paid/10 border-paid/20", amount: "positive" },
  neutral: { box: "bg-white/[0.04] border-border", amount: "neutral" },
};

interface ActivityHeroProps {
  overline: string;
  total: number;
  tone: ActivityHeroTone;
  onStatsPress: () => void;
}

export function ActivityHero({ overline, total, tone, onStatsPress }: ActivityHeroProps) {
  const { box, amount } = TONE[tone];

  return (
    <View className={`mx-5 mt-3 mb-1 rounded-2xl border ${box}`}>
      <View className="px-5 pt-5 pb-3">
        <AppText variant="overline">{overline}</AppText>
        <AppHeroAmount value={signedAmount(total)} tone={total < 0 ? "negative" : amount} className="mt-1" />
      </View>
      <TouchableOpacity
        onPress={onStatsPress}
        activeOpacity={0.7}
        className="min-h-[44px] flex-row items-center px-5 border-t border-white/[0.07]"
      >
        <Feather name="pie-chart" size={16} color={colors.textSecondary} />
        <AppText variant="body-bold" className="flex-1 ml-3 text-sm text-white">
          Stats
        </AppText>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
