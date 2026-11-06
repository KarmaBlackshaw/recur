import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

// What a row adds to Activity's "Net this month": money in is positive, money spent negative. Card charges count
// once their bill is paid, and loans stay out because lent money is still yours, so both add 0.
export function netFlow(entry: ActivityEntry): number {
  switch (entry.kind) {
    case "income":
    case "interest":
      return entry.amount;
    case "transfer":
      return entry.earned - entry.fee;
    case "billPayment":
      return -(entry.amount + entry.fee);
    case "loan":
      return 0;
    case "expense":
      return entry.isCard ? 0 : -entry.amount;
  }
}
