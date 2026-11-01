import { countLabel } from "@/utils/countLabel";
import type { Loan } from "@/types";

export function deleteLoanMessage({
  loan,
  paymentCount,
  incomeCount,
  accountName = "its account",
}: {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountName?: string;
}) {
  const removed = [
    { count: paymentCount, label: countLabel(paymentCount, "payment", "payments") },
    { count: incomeCount, label: countLabel(incomeCount, "income entry", "income entries") },
  ].filter(({ count }) => count > 0);
  if (removed.length > 0) {
    return `This loan and its ${removed.map(({ label }) => label).join(" and ")} are removed, and account balances go back.`;
  }
  if (loan.accountId == null) {
    return "This loan is removed and no account balance changes.";
  }
  return `This loan is removed and the money goes back to ${accountName}.`;
}
