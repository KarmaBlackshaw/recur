import { sortBy } from "@/utils/collections";
import type { AccountTransaction } from "@/types";

export type GetPayments = (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => AccountTransaction[];

function paymentKey(expenseId: string, cycleYear: number | null, cycleMonth: number | null) {
  return JSON.stringify([expenseId, cycleYear, cycleMonth]);
}

// The bill payments of each expense-month, oldest first. Pass in-effect transactions, not the raw ledger.
export function paymentLookup(transactions: AccountTransaction[]): GetPayments {
  const payments = new Map<string, AccountTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.kind !== "payment" || transaction.expenseId == null) {
      continue;
    }
    const key = paymentKey(transaction.expenseId, transaction.cycleYear, transaction.cycleMonth);
    const cyclePayments = payments.get(key);
    if (cyclePayments) {
      cyclePayments.push(transaction);
    } else {
      payments.set(key, [transaction]);
    }
  }
  for (const [key, cyclePayments] of payments) {
    payments.set(key, sortBy(cyclePayments, "createdAt"));
  }
  return (expenseId, cycleYear, cycleMonth) => [...(payments.get(paymentKey(expenseId, cycleYear, cycleMonth)) ?? [])];
}
