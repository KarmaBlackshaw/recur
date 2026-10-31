import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";

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
    <AppListRow
      icon="user"
      iconTone="accent"
      title={borrower}
      meta={count}
      amount={formatted}
      amountTone={isSettled ? "positive" : "neutral"}
      accessory="chevron-right"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={loanCount === 1 ? "Opens the loan" : "Opens this person's loans"}
    />
  );
}
