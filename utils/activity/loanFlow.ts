import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

export function loanFlow(entry: ActivityEntry): number {
  if (!("loanTxn" in entry)) {
    return 0;
  }
  return entry.loanTxn.kind === "loan_in" ? entry.amount : -entry.amount;
}
