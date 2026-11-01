import React from "react";
import { TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppHeroCard, type HeroTone } from "@/components/ui/AppHeroCard";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

interface ActivityHeroProps {
  overline: string;
  total: number;
  tone: HeroTone;
  onStatsPress: () => void;
}

export function ActivityHero({ overline, total, tone, onStatsPress }: ActivityHeroProps) {
  const statsRow = (
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
  );

  return (
    <AppHeroCard
      overline={overline}
      value={signedAmount(total)}
      tone={tone}
      isNegative={total < 0}
      footer={statsRow}
      className="mx-5 mt-3 mb-1"
    />
  );
}
