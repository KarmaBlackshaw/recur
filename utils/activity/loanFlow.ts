import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

export function loanFlow(entry: ActivityEntry): number {
  if (entry.kind !== "loan") {
    return 0;
  }
  return entry.loanTxn.kind === "loan_in" ? entry.amount : -entry.amount;
}
