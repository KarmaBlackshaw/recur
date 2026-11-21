import { formatAmount } from "@/utils/formatAmount";
import type { AccountTransaction } from "@/types";

export type TPaymentRemoval = {
  payment: AccountTransaction;
  excess: AccountTransaction | undefined;
  borrower: string;
  accountNameOf: (accountId: string) => string;
};

// What a payment's removal undoes, the Overpayment income it brought included.
export function paymentLeavesClause({ payment, excess, borrower, accountNameOf }: TPaymentRemoval): string {
  const moneyLeaves = `The money leaves ${accountNameOf(payment.accountId)} and ${borrower} owes it again`;
  if (!excess) {
    return moneyLeaves;
  }
  const excessLeaves =
    excess.accountId === payment.accountId ? "leaves too" : `leaves ${accountNameOf(excess.accountId)}`;
  return `${moneyLeaves}, so the ${formatAmount(excess.amount)} overpayment income ${excessLeaves}`;
}
