import type { Expense } from "@/types";
import { billProgress, type BillProgress } from "@/utils/expenses/billProgress";
import { displayAmountOf, type MonthLedger } from "@/utils/expenses/displayAmountOf";
import { monthKey } from "@/utils/monthKey";

export function billProgressOf(expense: Expense, year: number, month: number, ledger: MonthLedger): BillProgress {
  if (expense.recurrence === "one-off") {
    const isPaid = expense.status === "paid";
    return billProgress({
      bill: expense.amount,
      payments: isPaid && expense.amount != null ? [expense.amount] : [],
      isPaid,
    });
  }
  return billProgress({
    bill: displayAmountOf(expense, year, month, ledger),
    payments: ledger.getPayments(expense.id, year, month).map((t) => Math.abs(t.amount)),
    isPaid: ledger.monthStatuses[monthKey(expense.id, year, month)] === "paid",
  });
}
