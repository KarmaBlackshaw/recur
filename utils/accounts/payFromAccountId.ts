import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import type { Account, Expense } from "@/types";

// Where a new payment starts: the bill's account, Cash when that one is archived or deleted, none when it has none.
export function payFromAccountId({ accountId }: Expense, activeAccounts: Account[]): string | null {
  if (accountId == null) {
    return null;
  }
  return activeAccounts.some(({ id }) => id === accountId) ? accountId : CASH_ACCOUNT_ID;
}
