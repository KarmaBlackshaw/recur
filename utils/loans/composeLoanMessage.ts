import { loanEntriesLabel } from "@/utils/loans/loanEntriesLabel";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountNameOf: (id: string) => string;
  withEntries: (entries: string) => string;
  withoutAccount: string;
  withAccount: (accountName: string) => string;
}

export function composeLoanMessage({
  loan,
  paymentCount,
  incomeCount,
  accountNameOf,
  withEntries,
  withoutAccount,
  withAccount,
}: Props) {
  const entriesLabel = loanEntriesLabel({ paymentCount, incomeCount });
  if (entriesLabel != null) {
    return withEntries(entriesLabel);
  }

  if (loan.accountId == null) {
    return withoutAccount;
  }

  return withAccount(accountNameOf(loan.accountId));
}
