import type { TBalanceChange } from "@/utils/accounts/findOverdraft";
import type { LoanInput } from "@/types";

export function loanOutChanges(loan: Pick<LoanInput, "accountId" | "principal">): TBalanceChange[] {
  if (loan.accountId == null) {
    return [];
  }
  return [{ accountId: loan.accountId, amount: -loan.principal }];
}
