import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

export type ActivityHeroTone = "primary" | "secondary" | "paid" | "neutral";

const TONE: Record<ActivityHeroTone, { box: string; text: string }> = {
  primary: { box: "bg-primary/10 border-primary/20", text: "text-secondary" },
  secondary: { box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
  paid: { box: "bg-paid/10 border-paid/20", text: "text-paid" },
  neutral: { box: "bg-white/[0.04] border-border", text: "text-white" },
};

interface ActivityHeroProps {
  overline: string;
  total: number;
  tone: ActivityHeroTone;
  onStatsPress: () => void;
}

export function ActivityHero({ overline, total, tone, onStatsPress }: ActivityHeroProps) {
  const { box, text } = TONE[tone];

  return (
    <View className={`mx-5 mt-3 mb-1 rounded-2xl border ${box}`}>
      <View className="px-5 pt-5 pb-3">
        <AppText variant="overline">{overline}</AppText>
        <Text
          className={`text-[32px] font-oswald-medium mt-1 ${total < 0 ? "text-overdue" : text}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {signedAmount(total)}
        </Text>
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
