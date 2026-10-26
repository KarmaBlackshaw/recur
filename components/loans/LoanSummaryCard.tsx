import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { sumBy, groupBy, orderBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";

const MAX_ROWS = 5;

export function LoanSummaryCard() {
  const loans = useLoans();

  const debtors = useMemo(() => {
    const active = loans.loans.flatMap((loan) => {
      const summary = loans.summaries[loan.id];
      return summary == null || summary.isSettled ? [] : [{ borrower: loan.borrower, balance: summary.balance }];
    });
    const rows = Object.entries(groupBy(active, "borrower")).map(([borrower, items]) => ({
      borrower,
      balance: sumBy(items, "balance"),
    }));
    return orderBy(rows, "balance", "desc");
  }, [loans.loans, loans.summaries]);

  if (loans.isLoading || debtors.length === 0) {
    return null;
  }

  const total = formatAmount(sumBy(debtors, "balance"));
  const visible = debtors.slice(0, MAX_ROWS);
  const hiddenCount = debtors.length - visible.length;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/loans")}
      accessibilityRole="button"
      accessibilityLabel={`Loans, ${total} owed to you. ${visible
        .map(({ borrower, balance }) => `${borrower} owes ${formatAmount(balance)}`)
        .join(", ")}${hiddenCount > 0 ? `, and ${hiddenCount} more` : ""}`}
      accessibilityHint="Opens loans"
    >
      <View className="mx-5 mt-1 rounded-2xl px-4 py-3.5 border bg-secondary/10 border-secondary/20">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-xl bg-secondary/20 items-center justify-center mr-3">
            <Feather name="users" size={16} color={colors.secondary} />
          </View>
          <View className="flex-1">
            <AppText variant="meta">Owed to you</AppText>
            <AppText variant="amount" className="text-secondary" numberOfLines={1}>
              {total}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </View>
        <View className="mt-3 pt-2 gap-1.5 border-t border-white/[0.07]">
          {visible.map(({ borrower, balance }) => (
            <View key={borrower} className="flex-row items-center justify-between">
              <AppText variant="body" className="flex-1 mr-3" numberOfLines={1}>
                {borrower}
              </AppText>
              <AppText variant="body-bold">{formatAmount(balance)}</AppText>
            </View>
          ))}
          {hiddenCount > 0 && (
            <View className="flex-row items-center justify-between pt-1">
              <AppText variant="meta">+{hiddenCount} more</AppText>
              <AppText variant="body-medium" className="text-sm text-secondary">
                View all
              </AppText>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
