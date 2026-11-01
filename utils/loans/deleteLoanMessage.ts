import { countLabel } from "@/utils/countLabel";
import type { Loan } from "@/types";

export function deleteLoanMessage(loan: Loan, paymentCount: number, accountName = "its account") {
  if (paymentCount > 0) {
    return `This loan and its ${countLabel(paymentCount, "payment", "payments")} are removed, and account balances go back.`;
  }
  if (loan.accountId == null) {
    return "This loan is removed and no account balance changes.";
  }
  return `This loan is removed and the money goes back to ${accountName}.`;
}
