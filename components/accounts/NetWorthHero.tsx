import React from "react";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppHeroAmount } from "@/components/ui/AppHeroAmount";
import { useNetWorth } from "@/utils/useNetWorth";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

export function NetWorthHero() {
  const { assets, lent, owed, net } = useNetWorth();
  const isNegative = net < 0;
  const netText = signedAmount(net);
  // "Lent" only appears while someone owes you money.
  const parts = [
    { label: "Assets", value: assets },
    ...(lent > 0 ? [{ label: "Lent", value: lent }] : []),
    { label: "Owed", value: owed },
  ];

  return (
    <View
      className={`rounded-2xl px-4 py-4 border ${
        isNegative ? "bg-overdue/[0.06] border-overdue/30" : "bg-surface border-white/[0.07]"
      }`}
      accessible
      accessibilityLabel={`Net worth ${netText}. ${parts.map(({ label, value }) => `${label} ${signedAmount(value)}`).join(", ")}`}
    >
      <AppText variant="overline">Net worth</AppText>
      <View className="flex-row items-center gap-2 mt-1">
        {isNegative && <Feather name="alert-triangle" size={20} color={colors.overdue} />}
        <AppHeroAmount value={netText} tone={isNegative ? "negative" : "neutral"} className="flex-1" />
      </View>
      <View className="flex-row gap-3 mt-3 pt-3 border-t border-white/[0.07]">
        {parts.map(({ label, value }) => (
          <View key={label} className="flex-1">
            <AppText variant="meta">{label}</AppText>
            <AppText variant="amount-sm" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {signedAmount(value)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
