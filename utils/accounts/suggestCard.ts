import dayjs from "dayjs";
import { billForPurchase } from "@/utils/cardBills";
import { orderBy } from "@/utils/collections";
import { round } from "@/utils/round";
import type { Account } from "@/types";

export type CardSuggestion = { account: Account; dueDate: Date; days: number };

// The credit card to use today: the one whose bill for a purchase made today is due furthest away,
// then the one with more credit left. Needs two cards with statement and due days to compare;
// a card with a limit and nothing left is skipped, a card without a limit never is.
export function suggestCard({
  accounts,
  getBalance,
  today,
}: {
  accounts: Account[];
  getBalance: (accountId: string) => number;
  today: Date;
}): CardSuggestion | null {
  const day = dayjs(today).startOf("day");
  const cards = accounts.flatMap((account) => {
    const { statementDay, dueDay, creditLimit } = account;
    if (account.type !== "credit" || account.archivedAt || statementDay == null || dueDay == null) {
      return [];
    }
    const { dueDate } = billForPurchase(statementDay, dueDay, day.toDate());
    const available = creditLimit == null ? Infinity : round(creditLimit - getBalance(account.id), 2);
    return [{ account, dueDate, days: dayjs(dueDate).diff(day, "day"), available }];
  });
  if (cards.length < 2) {
    return null;
  }
  const usable = cards.filter(({ available }) => available > 0);
  const [best] = orderBy(usable, ["days", "available"], ["desc", "desc"]);
  return best ? { account: best.account, dueDate: best.dueDate, days: best.days } : null;
}
