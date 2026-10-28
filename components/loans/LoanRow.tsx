import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
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
  const { borrower, lentAt, interest, note } = loan;
  const { isSettled, balance, paidTotal, settledAt } = summary;
  const age = formatLoanAge(lentAt, isSettled ? (settledAt ?? today) : today);
  const meta = isSettled ? "Settled" : `${accountName ?? "Deleted account"} · ${formatLoanInterest(interest)}`;
  const caption = isSettled ? `ran ${age}` : age;
  const amount = formatAmount(isSettled ? paidTotal : balance);
  const name = note ? `${borrower}, ${note}` : borrower;
  const label = isSettled
    ? `${name}, settled, paid ${amount} over ${age}`
    : `${name}, owes ${amount}, ${age}`;

  return (
    <AppListRow
      icon="user"
      iconTone="accent"
      title={note || borrower}
      meta={meta}
      amount={amount}
      amountTone={isSettled ? "positive" : "neutral"}
      caption={caption}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint="Opens loan details"
    />
  );
}
