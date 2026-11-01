import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/dateHelpers";
import { formatLoanAge } from "@/utils/loans/formatLoanAge";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import { DELETED_ACCOUNT } from "@/constants/accounts";
import { EXISTING_LOAN } from "@/constants/loans";
import type { TLoanSummary } from "@/utils/loans/summarizeLoan";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  summary: TLoanSummary;
  accountName: string | undefined;
  today: string;
  // Defaults to the note, else the borrower. Lists scoped to one borrower title rows by note or amount instead.
  title?: string;
  onPress: () => void;
}

export function LoanRow({ loan, summary, accountName, today, title = loan.note || loan.borrower, onPress }: Props) {
  const { borrower, lentAt, interest } = loan;
  const { isSettled, balance, paidTotal, settledAt } = summary;
  const age = formatLoanAge(lentAt, isSettled ? (settledAt ?? today) : today);
  const lentFrom = loan.accountId == null ? EXISTING_LOAN : (accountName ?? DELETED_ACCOUNT);
  const meta = isSettled ? "Settled" : `${lentFrom} · ${formatLoanInterest(interest)}`;
  const caption = isSettled ? `ran ${age}` : age;
  const amount = formatAmount(isSettled ? paidTotal : balance);
  const name = title === borrower ? borrower : `${borrower}, ${title}`;
  const label = isSettled
    ? `${name}, settled, paid ${amount} over ${age}`
    : `${name}, owes ${amount}, ${age}`;

  return (
    <AppListRow
      icon="user"
      iconTone="accent"
      title={title}
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
