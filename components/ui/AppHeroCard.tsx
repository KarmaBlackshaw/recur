import React from "react";
import { View, type ViewProps } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { AppHeroAmount } from "@/components/ui/AppHeroAmount";
import type { RowTone } from "@/components/ui/AppListRow";
import { mergeClassNames } from "@/utils/mergeClassNames";

export type HeroTone = "primary" | "secondary" | "paid" | "neutral";

const HERO_TONE: Record<HeroTone, { box: string; amount: RowTone }> = {
  primary: { box: "bg-primary/10 border-primary/20", amount: "accent" },
  secondary: { box: "bg-secondary/10 border-secondary/20", amount: "accent" },
  paid: { box: "bg-paid/10 border-paid/20", amount: "positive" },
  neutral: { box: "bg-white/[0.04] border-border", amount: "neutral" },
};

interface AppHeroCardProps extends ViewProps {
  overline: string;
  value: string;
  tone: HeroTone;
  isNegative?: boolean;
  footer?: React.ReactNode;
}

export function AppHeroCard({ overline, value, tone, isNegative, footer, className, children, ...rest }: AppHeroCardProps) {
  const { box, amount } = HERO_TONE[tone];

  return (
    <View className={mergeClassNames(`rounded-2xl border ${box}`, className)} {...rest}>
      <View className={`px-5 pt-5 ${footer ? "pb-3" : "pb-5"}`}>
        <AppText variant="overline">{overline}</AppText>
        <AppHeroAmount value={value} tone={isNegative ? "negative" : amount} className="mt-1" />
        {children}
      </View>
      {footer}
    </View>
  );
}
