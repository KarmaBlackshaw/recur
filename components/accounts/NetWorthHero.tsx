import React from "react";
import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppBreakdownRow } from "@/components/ui/AppBreakdownRow";
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
  const breakdown = parts.map(({ label, value }) => ({ label, value: signedAmount(value) }));

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
        <Text
          className={`flex-1 text-[32px] font-oswald-medium ${isNegative ? "text-overdue" : "text-white"}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {netText}
        </Text>
      </View>
      <AppBreakdownRow items={breakdown} className="mt-3" />
    </View>
  );
}
