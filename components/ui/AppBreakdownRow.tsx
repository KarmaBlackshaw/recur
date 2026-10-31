import React from "react";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { mergeClassNames } from "@/utils/mergeClassNames";

export interface TBreakdownItem {
  label: string;
  value: string;
}

interface AppBreakdownRowProps {
  items: TBreakdownItem[];
  className?: string;
}

export function AppBreakdownRow({ items, className }: AppBreakdownRowProps) {
  return (
    <View className={mergeClassNames("flex-row gap-3 pt-3 border-t border-border", className)}>
      {items.map(({ label, value }) => (
        <View key={label} className="flex-1">
          <AppText variant="meta">{label}</AppText>
          <AppText variant="amount-sm" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </AppText>
        </View>
      ))}
    </View>
  );
}
