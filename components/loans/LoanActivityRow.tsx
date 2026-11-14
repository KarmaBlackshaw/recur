import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { useAccounts } from "@/context/AccountContext";
import { formatAmount } from "@/utils/formatAmount";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";

export function LoanActivityRow({ entry, onPress }: { entry: LoanActivityEntry; onPress: () => void }) {
  const accounts = useAccounts();
  const { loanTxn, loan, amount } = entry;
  const borrower = loan?.borrower;
  const title = borrower == null ? "Loan" : `Lent to ${borrower}`;
  const signed = `−${formatAmount(amount)}`;
  const accountName = accounts.nameOf(loanTxn.accountId);
  const meta = [accountName, loan?.note].filter(Boolean).join(" · ");

  return (
    <AppListRow
      icon="arrow-up-right"
      iconTone="neutral"
      title={title}
      meta={meta}
      amount={signed}
      amountTone="neutral"
      onPress={loan ? onPress : undefined}
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint={loan ? "Opens loan details" : undefined}
    />
  );
}
