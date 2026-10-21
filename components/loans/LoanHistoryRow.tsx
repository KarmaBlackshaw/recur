import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { AccountTransaction, FeatherIconName } from "@/types";

interface TLoanHistoryBase {
  key: string;
  date: string;
  amount: number;
  accountName: string | undefined;
}

export type TLoanHistoryItem =
  | (TLoanHistoryBase & { kind: "lent" })
  | (TLoanHistoryBase & { kind: "interest" })
  | (TLoanHistoryBase & { kind: "payment"; txn: AccountTransaction });

const KIND_META: Record<TLoanHistoryItem["kind"], { icon: FeatherIconName; tone: string; sign: string }> = {
  lent: { icon: "arrow-up-right", tone: "text-white", sign: "−" },
  interest: { icon: "trending-up", tone: "text-textSecondary", sign: "" },
  payment: { icon: "arrow-down-left", tone: "text-paid", sign: "+" },
};

function labelOf({ kind, accountName }: TLoanHistoryItem) {
  const account = accountName ?? "Deleted account";
  switch (kind) {
    case "lent":
      return `Lent from ${account}`;
    case "interest":
      return "Interest";
    case "payment":
      return `Paid into ${account}`;
  }
}

export function LoanHistoryRow({ item, onPress }: { item: TLoanHistoryItem; onPress?: () => void }) {
  const { icon, tone, sign } = KIND_META[item.kind];
  const label = labelOf(item);
  const signed = `${sign}${formatAmount(item.amount)}`;
  const dateLabel = dayjs(item.date).format("MMM D");

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 px-5 py-3 min-h-[60px]"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}, ${signed}, ${dateLabel}`}
      accessibilityHint={onPress ? "Deletes this payment" : undefined}
    >
      <View className="w-9 h-9 rounded-xl bg-white/[0.07] items-center justify-center">
        <Feather name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View className="flex-1">
        <AppText variant="body-bold" className="text-sm" numberOfLines={1}>{label}</AppText>
      </View>
      <AppText variant="amount" className={`text-[15px] ${tone}`}>{signed}</AppText>
      {onPress && <Feather name="trash-2" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}
