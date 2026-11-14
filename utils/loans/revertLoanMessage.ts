import { composeLoanMessage } from "@/utils/loans/composeLoanMessage";
import { staysInHistory } from "@/utils/loans/staysInHistory";
import type { Loan } from "@/types";

export function revertLoanMessage(args: {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountNameOf: (id: string) => string;
}) {
  return composeLoanMessage({
    ...args,
    withEntries: (entries) => `Account balances go back. ${staysInHistory(`This loan and its ${entries}`, true)}`,
    withoutAccount: "This loan is reverted and no account balance changes.",
    withAccount: (accountName) => `The money goes back to ${accountName}. ${staysInHistory("The loan")}`,
  });
}
