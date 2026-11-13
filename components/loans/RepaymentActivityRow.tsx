import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";
import { loanTitle } from "@/utils/loans/loanTitle";
import { repaidTitle } from "@/utils/loans/repaidTitle";
import { useAccountNameOf } from "@/utils/accounts/useAccountNameOf";
import { repaymentLabels } from "@/utils/loans/repaymentLabels";
import type { RepaymentActivityEntry } from "@/utils/useLoanActivity";

interface Props {
  entry: RepaymentActivityEntry;
  onPress?: () => void;
}

export function RepaymentActivityRow({ entry, onPress }: Props): React.JSX.Element {
  const { repayment, excess, amount } = entry;
  const { borrower, payments } = repayment;
  const labels = repaymentLabels(repayment, useAccountNameOf());
  const singleLoan = payments.length === 1 ? payments[0].loan : undefined;
  const secondary = singleLoan ? loanTitle(singleLoan) : labels.loans;
  const title = borrower ? repaidTitle(borrower) : "Loan";
  const signed = `+${formatAmount(amount)}`;
  const meta = `${labels.account} · ${secondary}`;
  const caption = [labels.settledLead, excess ? labels.extra : null].filter(Boolean).join(" · ");

  return (
    <AppListRow
      icon="arrow-down-left"
      iconTone="positive"
      title={title}
      meta={meta}
      amount={signed}
      amountTone="positive"
      caption={caption || undefined}
      onPress={onPress}
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
    />
  );
}
