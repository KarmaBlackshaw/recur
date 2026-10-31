import React, { useMemo } from "react";
import { router } from "expo-router";
import { sumBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";

export interface OwedToYou {
  total: number;
  people: number;
}

// What people still owe you on open loans. Null while loans load or once nobody owes anything.
export function useOwedToYou(): OwedToYou | null {
  const { loans, summaries, isLoading } = useLoans();

  return useMemo(() => {
    if (isLoading) {
      return null;
    }
    const open = loans.flatMap((loan) => {
      const summary = summaries[loan.id];
      return summary == null || summary.isSettled ? [] : [{ borrower: loan.borrower, balance: summary.balance }];
    });
    if (open.length === 0) {
      return null;
    }
    return { total: sumBy(open, "balance"), people: new Set(open.map(({ borrower }) => borrower)).size };
  }, [loans, summaries, isLoading]);
}

// Home's one-row loans summary, between the due bands and Recent activity.
export function LoanSummaryCard({ total, people }: OwedToYou) {
  const amount = formatAmount(total);
  const peopleText = `${people} ${people === 1 ? "person" : "people"}`;

  return (
    <AppListRow
      icon="users"
      iconTone="accent"
      title="Owed to you"
      meta={peopleText}
      amount={amount}
      amountTone="accent"
      accessory="chevron-right"
      onPress={() => router.navigate("/loans")}
      accessibilityLabel={`Owed to you, ${amount} from ${peopleText}`}
      accessibilityHint="Opens loans"
    />
  );
}
