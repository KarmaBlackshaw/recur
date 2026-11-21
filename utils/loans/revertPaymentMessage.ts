import { formatAmount } from "@/utils/formatAmount";
import { staysInHistory } from "@/utils/loans/staysInHistory";
import type { AccountTransaction } from "@/types";

export function revertPaymentMessage({
  payment,
  excess,
  borrower,
  accountNameOf,
}: {
  payment: AccountTransaction;
  excess: AccountTransaction | undefined;
  borrower: string;
  accountNameOf: (accountId: string) => string;
}): string {
  const moneyLeaves = `The money leaves ${accountNameOf(payment.accountId)} and ${borrower} owes it again`;
  if (!excess) {
    return `${moneyLeaves}. ${staysInHistory("The payment")}`;
  }
  const excessLeaves =
    excess.accountId === payment.accountId ? "leaves too" : `leaves ${accountNameOf(excess.accountId)}`;
  return `${moneyLeaves}, so the ${formatAmount(excess.amount)} overpayment income ${excessLeaves}. ${staysInHistory("Both", true)}`;
}
