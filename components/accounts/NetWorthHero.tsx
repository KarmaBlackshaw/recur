import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

export function NetWorthHero() {
  const { netWorth } = useAccounts();
  const isNegative = netWorth.net < 0;
  const netText = signedAmount(netWorth.net);
  const assetsText = signedAmount(netWorth.assets);
  const owedText = signedAmount(netWorth.owed);

  return (
    <View
      className={`rounded-2xl px-4 py-4 border ${
        isNegative ? "bg-overdue/[0.06] border-overdue/30" : "bg-surface border-white/[0.07]"
      }`}
      accessible
      accessibilityLabel={`Net worth ${netText}. Assets ${assetsText}, owed ${owedText}`}
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
      <AppText variant="meta" className="mt-1" numberOfLines={1}>
        {`Assets ${assetsText} · Owed ${owedText}`}
      </AppText>
    </View>
  );
}
