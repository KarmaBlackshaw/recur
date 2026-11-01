import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { useAccounts } from "@/context/AccountContext";
import { formatAmount } from "@/utils/dateHelpers";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";

export function LoanActivityRow({ entry, onPress }: { entry: LoanActivityEntry; onPress: () => void }) {
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
      onPress={loan ? onPress : undefined}
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint={loan ? "Opens loan details" : undefined}
    />
  );
}
