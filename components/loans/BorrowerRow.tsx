import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";

interface Props {
  borrower: string;
  loanCount: number;
  amount: number;
  isSettled: boolean;
  onPress: () => void;
}

export function BorrowerRow({ borrower, loanCount, amount, isSettled, onPress }: Props) {
  const count = `${loanCount} ${isSettled ? "settled " : ""}loan${loanCount === 1 ? "" : "s"}`;
  const formatted = formatAmount(amount);
  const label = isSettled ? `${borrower}, ${count}, paid ${formatted}` : `${borrower}, ${count}, owes ${formatted}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this person's loans"
    >
      <View className="flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] bg-surface">
        <View className="w-10 h-10 rounded-xl bg-secondary/15 items-center justify-center mr-3">
          <Feather name="user" size={18} color={colors.secondary} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
            {borrower}
          </AppText>
          <AppText variant="meta" className="mt-1" numberOfLines={1}>
            {count}
          </AppText>
        </View>
        <AppText variant="amount" className={`ml-3 mr-2 ${isSettled ? "text-paid" : "text-white"}`} numberOfLines={1}>
          {formatted}
        </AppText>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
