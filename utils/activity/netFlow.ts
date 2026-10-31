import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

// What a row adds to Activity's "Net this month": money in is positive, money spent negative. Card charges count
// once their bill is paid, and loans stay out because lent money is still yours, so both add 0.
export function netFlow(entry: ActivityEntry): number {
  if ("income" in entry || "interest" in entry) {
    return entry.amount;
  }
  if ("transfer" in entry) {
    return entry.earned - entry.fee;
  }
  if ("payment" in entry) {
    return -(entry.amount + entry.fee);
  }
  if ("loanTxn" in entry || entry.isCard) {
    return 0;
  }
  return -entry.amount;
}
