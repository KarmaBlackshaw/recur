import type { Account, AccountTransaction } from "@/types";

export function splitTransfer(rows: AccountTransaction[], accounts: Account[]) {
  const isCredit = ({ accountId }: AccountTransaction) => accounts.find(({ id }) => id === accountId)?.type === "credit";
  const sides = rows.filter(({ kind }) => kind === "transfer");
  // A payment lowers what a card owes, so a card's To side is negative too.
  const from = sides.find((t) => t.amount < 0 && !isCredit(t));
  const to = sides.find((t) => t !== from);
  return {
    from,
    to,
    fee: rows.find(({ kind }) => kind === "fee"),
    income: rows.find(({ kind }) => kind === "income"),
    isBillPayment: to != null && isCredit(to),
  };
}
