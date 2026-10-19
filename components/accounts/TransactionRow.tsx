import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import {
  TRANSACTION_KIND_LABEL,
  type AccountTransaction,
  type AccountType,
  type FeatherIconName,
  type TransactionKind,
} from "@/types";

const KIND_ICON: Record<TransactionKind, FeatherIconName> = {
  payment: "shopping-bag",
  interest: "trending-up",
  tax: "percent",
  transfer: "repeat",
  fee: "scissors",
  adjust: "sliders",
  income: "arrow-down-left",
};

interface Props {
  transaction: AccountTransaction;
  accountType: AccountType;
  onPress?: () => void;
}

export function TransactionRow({ transaction, accountType, onPress }: Props) {
  const label = TRANSACTION_KIND_LABEL[transaction.kind];
  const icon = KIND_ICON[transaction.kind];
  const isMoneyIn = accountType === "credit" ? transaction.amount < 0 : transaction.amount > 0;
  const signed = `${transaction.amount < 0 ? "−" : "+"}${formatAmount(Math.abs(transaction.amount))}`;
  const time = dayjs(transaction.createdAt).format("h:mm A");
  const subtitle = [transaction.category, transaction.note, time].filter(Boolean).join(" · ");

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 px-5 py-3 min-h-[60px]"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}, ${signed}, ${subtitle}`}
      accessibilityHint={onPress ? "Offers to delete this transfer" : undefined}
    >
      <View className="w-9 h-9 rounded-xl bg-white/[0.07] items-center justify-center">
        <Feather name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View className="flex-1">
        <AppText variant="body-bold" className="text-sm">{label}</AppText>
        <AppText variant="meta" className="text-textMuted" numberOfLines={1}>{subtitle}</AppText>
      </View>
      <AppText variant="amount" className={`text-[15px] ${isMoneyIn ? "text-paid" : "text-white"}`}>
        {signed}
      </AppText>
    </TouchableOpacity>
  );
}
