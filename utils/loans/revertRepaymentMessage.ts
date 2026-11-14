import { formatAmount } from "@/utils/formatAmount";
import { loanEntriesLabel } from "@/utils/loans/loanEntriesLabel";
import { staysInHistory } from "@/utils/loans/staysInHistory";
import type { TRepayment } from "@/types";

export function revertRepaymentMessage({
  repayment,
  borrower,
  accountLabel,
  owesAgain,
}: {
  repayment: TRepayment;
  borrower: string;
  accountLabel: string;
  owesAgain: number | undefined;
}): { title: string; message: string } {
  const { payments, excess, total } = repayment;
  const entriesLabel = loanEntriesLabel({ paymentCount: payments.length, incomeCount: excess ? 1 : 0 });
  const isSingleEntry = payments.length === 1 && !excess;
  const tail =
    entriesLabel == null || isSingleEntry
      ? staysInHistory("The payment")
      : staysInHistory(`The ${entriesLabel}`, true);
  const owed = owesAgain == null ? "it" : formatAmount(owesAgain);

  return {
    title: `Revert ${borrower}'s ${formatAmount(total)} repayment?`,
    message: `${formatAmount(total)} leaves ${accountLabel} and ${borrower} owes ${owed} again. ${tail}`,
  };
}
