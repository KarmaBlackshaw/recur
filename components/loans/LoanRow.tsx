import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { formatLoanAge } from "@/utils/loans/formatLoanAge";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import type { TLoanSummary } from "@/utils/loans/summarizeLoan";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  summary: TLoanSummary;
  accountName: string | undefined;
  today: string;
  onPress: () => void;
}

export function LoanRow({ loan, summary, accountName, today, onPress }: Props) {
  const { borrower, lentAt, interest } = loan;
  const { isSettled, balance, paidTotal, settledAt } = summary;
  const age = formatLoanAge(lentAt, isSettled ? (settledAt ?? today) : today);
  const meta = isSettled
    ? `settled · ran ${age}`
    : `${accountName ?? "Deleted account"} · ${formatLoanInterest(interest)} · ${age}`;
  const amount = formatAmount(isSettled ? paidTotal : balance);
  const amountColor = isSettled ? "text-paid" : "text-white";
  const label = isSettled
    ? `${borrower}, settled, paid ${amount} over ${age}`
    : `${borrower}, owes ${amount}, ${age}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens loan details"
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
            {meta}
          </AppText>
        </View>
        <AppText variant="amount" className={`ml-3 ${amountColor}`} numberOfLines={1}>
          {amount}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}
