import type { Expense, Status } from "@/types";
import type { GetPayments } from "@/utils/accounts/paymentLookup";
import { monthKey } from "@/utils/monthKey";

export interface MonthLedger {
  monthStatuses: Record<string, Status>;
  monthAmounts: Record<string, number | null>;
  getPayments: GetPayments;
}

// A variable bill reads its stored month amount; a fixed one reads it once the month is paid or part paid.
export function displayAmountOf(
  expense: Expense,
  year: number,
  month: number,
  { monthStatuses, monthAmounts, getPayments }: MonthLedger
): number | null {
  if (expense.recurrence === "one-off") {
    return expense.amount;
  }
  const k = monthKey(expense.id, year, month);
  const stored = monthAmounts[k] ?? null;
  if (expense.isVariable) {
    return stored;
  }
  if (stored != null && (monthStatuses[k] === "paid" || getPayments(expense.id, year, month).length > 0)) {
    return stored;
  }
  return expense.amount;
}
