import React from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";

export function LoanActivityRow({ entry }: { entry: LoanActivityEntry }) {
  const accounts = useAccounts();
  const { loanTxn, loan, amount } = entry;
  const isRepayment = loanTxn.kind === "loan_in";
  const borrower = loan?.borrower;
  const title = borrower == null ? "Loan" : isRepayment ? `${borrower} repaid` : `Lent to ${borrower}`;
  const signed = `${isRepayment ? "+" : "−"}${formatAmount(amount)}`;
  const meta = accounts.accounts.find(({ id }) => id === loanTxn.accountId)?.name ?? "Deleted account";
  const tileClass = isRepayment ? "bg-paid/15" : "bg-white/[0.07]";
  const amountClass = isRepayment ? "text-paid" : "text-white";

  const card = (
    <View className="flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] bg-surface">
      <View className={`w-10 h-10 rounded-xl ${tileClass} items-center justify-center mr-3`}>
        <Feather
          name={isRepayment ? "arrow-down-left" : "arrow-up-right"}
          size={18}
          color={isRepayment ? colors.paid : colors.textSecondary}
        />
      </View>
      <View className="flex-1">
        <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" className="mt-1" numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <AppText variant="amount" className={`ml-3 ${amountClass}`} numberOfLines={1}>
        {signed}
      </AppText>
    </View>
  );

  if (!loan) {
    return <View accessible accessibilityLabel={`${title}, ${signed}, ${meta}`}>{card}</View>;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: "/loan/[id]", params: { id: loan.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint="Opens loan details"
    >
      {card}
    </TouchableOpacity>
  );
}
