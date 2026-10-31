import React from "react";
import { router } from "expo-router";
import { AppListRow } from "@/components/ui/AppListRow";
import { useAccounts } from "@/context/AccountContext";
import { formatAmount } from "@/utils/formatAmount";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";

export function LoanActivityRow({ entry }: { entry: LoanActivityEntry }) {
  const accounts = useAccounts();
  const { loanTxn, loan, amount } = entry;
  const isRepayment = loanTxn.kind === "loan_in";
  const borrower = loan?.borrower;
  const title = borrower == null ? "Loan" : isRepayment ? `${borrower} repaid` : `Lent to ${borrower}`;
  const signed = `${isRepayment ? "+" : "−"}${formatAmount(amount)}`;
  const accountName = accounts.accounts.find(({ id }) => id === loanTxn.accountId)?.name ?? "Deleted account";
  const meta = [accountName, loan?.note].filter(Boolean).join(" · ");

  return (
    <AppListRow
      icon={isRepayment ? "arrow-down-left" : "arrow-up-right"}
      iconTone={isRepayment ? "positive" : "neutral"}
      title={title}
      meta={meta}
      amount={signed}
      amountTone={isRepayment ? "positive" : "neutral"}
      onPress={loan ? () => router.push({ pathname: "/loan/[id]", params: { id: loan.id } }) : undefined}
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint={loan ? "Opens loan details" : undefined}
    />
  );
}
