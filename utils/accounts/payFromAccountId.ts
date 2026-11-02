import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import type { Account, Expense } from "@/types";

// Where a new payment starts: the bill's account, or Cash when it has none or that one is archived or deleted.
export function payFromAccountId({ accountId }: Expense, activeAccounts: Account[]): string {
  return activeAccounts.find(({ id }) => id === accountId)?.id ?? CASH_ACCOUNT_ID;
}
