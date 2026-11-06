import { composeLoanMessage } from "@/utils/loans/composeLoanMessage";
import type { Loan } from "@/types";

export function revertLoanMessage(args: {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountName?: string;
}) {
  return composeLoanMessage({
    ...args,
    withEntries: (entries) =>
      `Account balances go back. This loan and its ${entries} stay in the account history, marked as reverted.`,
    withoutAccount: "This loan is reverted and no account balance changes.",
    withAccount: (accountName) =>
      `The money goes back to ${accountName}. The loan stays in the account history, marked as reverted.`,
  });
}
