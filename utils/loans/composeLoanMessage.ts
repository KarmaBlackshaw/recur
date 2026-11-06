import { countLabel } from "@/utils/countLabel";
import type { Loan } from "@/types";

interface Props {
  loan: Loan;
  paymentCount: number;
  incomeCount: number;
  accountName?: string;
  withEntries: (entries: string) => string;
  withoutAccount: string;
  withAccount: (accountName: string) => string;
}

export function composeLoanMessage({
  loan,
  paymentCount,
  incomeCount,
  accountName = "its account",
  withEntries,
  withoutAccount,
  withAccount,
}: Props) {
  const entries = [
    { count: paymentCount, label: countLabel(paymentCount, "payment", "payments") },
    { count: incomeCount, label: countLabel(incomeCount, "income entry", "income entries") },
  ].filter(({ count }) => count > 0);

  if (entries.length > 0) {
    return withEntries(entries.map(({ label }) => label).join(" and "));
  }

  if (loan.accountId == null) {
    return withoutAccount;
  }

  return withAccount(accountName);
}
