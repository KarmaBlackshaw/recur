import type { Account, AccountTransaction } from "@/types";

export interface TBalanceChange {
  accountId: string;
  amount: number;
}

export interface TOverdraft {
  account: Account;
  shortfall: number;
}

interface TFindOverdraftOptions {
  accounts: Account[];
  transactions: AccountTransaction[];
  changes: TBalanceChange[];
  isReplaced?: (transaction: AccountTransaction) => boolean;
}

const toCents = (amount: number) => Math.round(amount * 100);

// Debit and cash accounts can't go below zero. Only a change that lowers a balance is checked, so an account
// that's already overdrawn can still be topped up. Credit cards are never overdrawn.
export function findOverdraft({ accounts, transactions, changes, isReplaced }: TFindOverdraftOptions): TOverdraft | undefined {
  const deltas = new Map<string, number>();
  const addDelta = (accountId: string, amount: number) => {
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + toCents(amount));
  };
  for (const transaction of transactions) {
    if (isReplaced?.(transaction)) {
      addDelta(transaction.accountId, -transaction.amount);
    }
  }
  for (const change of changes) {
    addDelta(change.accountId, change.amount);
  }
  for (const [accountId, delta] of deltas) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account || account.type === "credit" || delta >= 0) {
      continue;
    }
    const next = transactions.reduce((sum, t) => (t.accountId === accountId ? sum + toCents(t.amount) : sum), delta);
    if (next < 0) {
      return { account, shortfall: -next / 100 };
    }
  }
  return undefined;
}
