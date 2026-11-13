import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

export function loanFlow(entry: ActivityEntry): number {
  if (entry.kind === "repayment") {
    return entry.repayment.principal;
  }
  if (entry.kind !== "loan") {
    return 0;
  }
  return -entry.amount;
}
