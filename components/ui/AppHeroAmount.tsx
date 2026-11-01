import React from "react";
import { Text } from "react-native";
import { AMOUNT_TONE, type RowTone } from "@/components/ui/AppListRow";
import { mergeClassNames } from "@/utils/mergeClassNames";

interface AppHeroAmountProps {
  value: string;
  tone?: RowTone;
  className?: string;
}

export function AppHeroAmount({ value, tone = "neutral", className }: AppHeroAmountProps) {
  return (
    <Text
      className={mergeClassNames(`text-[32px] font-oswald-medium ${AMOUNT_TONE[tone]}`, className)}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      maxFontSizeMultiplier={1.4}
    >
      {value}
    </Text>
  );
}
