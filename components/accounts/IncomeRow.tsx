import React from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { IncomeEntry } from "@/utils/usePaidLedger";

export function IncomeRow({ entry }: { entry: IncomeEntry }) {
  const { accounts } = useAccounts();
  const { income } = entry;
  const title = income.category ?? "Income";
  const accountName = accounts.find(({ id }) => id === income.accountId)?.name;
  const meta = [accountName, income.note].filter(Boolean).join(" · ") || "Income";
  const signed = `+${formatAmount(income.amount)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: "/income/add", params: { id: income.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint="Edits this income"
    >
      <View className="flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] bg-surface">
        <View className="w-10 h-10 rounded-xl bg-paid/15 items-center justify-center mr-3">
          <Feather name="arrow-down-left" size={18} color={colors.paid} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="meta" className="mt-1" numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <AppText variant="amount" className="ml-3 text-paid" numberOfLines={1}>
          {signed}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}
