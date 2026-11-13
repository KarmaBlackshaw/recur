import { composeLoanMessage } from "@/utils/loans/composeLoanMessage";
import type { Loan } from "@/types";

export function deleteLoanMessage(args: {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountNameOf: (id: string) => string;
}) {
  return composeLoanMessage({
    ...args,
    withEntries: (entries) => `This loan and its ${entries} are removed, and account balances go back.`,
    withoutAccount: "This loan is removed and no account balance changes.",
    withAccount: (accountName) => `This loan is removed and the money goes back to ${accountName}.`,
  });
}
