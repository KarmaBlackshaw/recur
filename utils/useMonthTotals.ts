import dayjs from "dayjs";
import { sumBy } from "@/utils/collections";
import { hasCycleIn } from "@/utils/dateHelpers";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import type { Expense } from "@/types";

export interface MonthTotals {
  total: number;
  paid: number;
  unpaid: number;
  charged: number;
}

// A month's money due and settled. `isRecurringOnly` counts bills only (the Recurring tab). Otherwise it also counts
// that month's one-off spending, card bills and transfer fees (Home).
export function useMonthTotals(year: number, month: number, isRecurringOnly = false): MonthTotals {
  const { expenses, resolveAmount, getMonthStatus } = useExpenses();
  const { getCardBills, isCardCharge, isCharged, transactions } = useAccounts();

  const isInMonth = (e: Expense) => {
    if (e.recurrence !== "one-off") {
      return hasCycleIn(e, year, month);
    }
    if (isRecurringOnly) {
      return false;
    }
    const d = dayjs(e.paidDate ?? e.createdAt);
    return d.year() === year && d.month() === month;
  };
  const cycleOf = (e: Expense) =>
    e.recurrence === "one-off" ? { cycleYear: null, cycleMonth: null } : { cycleYear: year, cycleMonth: month };

  const resolved = expenses.filter(isInMonth).map((e) => {
    const { cycleYear, cycleMonth } = cycleOf(e);
    return {
      expense: e,
      status: getMonthStatus(e.id, year, month),
      isCard: isCardCharge(e.id, cycleYear, cycleMonth, e.accountId),
    };
  });
  // A paid card charge is counted through its card bill instead, so it isn't counted twice.
  const counted = resolved.filter(({ isCard, status }) => !isCard || status === "unpaid");
  const amountOf = ({ expense }: { expense: Expense }) => resolveAmount(expense, year, month);
  const bills = isRecurringOnly ? [] : getCardBills(year, month).filter((b) => b.amount > 0);
  const fees = isRecurringOnly
    ? 0
    : -sumBy(
        transactions.filter((t) => {
          const d = dayjs(t.createdAt);
          return t.kind === "fee" && d.year() === year && d.month() === month;
        }),
        "amount"
      );

  const total = sumBy(counted, amountOf) + sumBy(bills, (b) => b.amount) + fees;
  const paid =
    sumBy(counted.filter(({ status }) => status === "paid"), amountOf) +
    sumBy(bills, (b) => Math.min(b.paid, b.amount)) +
    fees;
  const charged = sumBy(
    resolved.filter(({ expense, isCard, status }) => {
      if (!isCard || status !== "paid") {
        return false;
      }
      const { cycleYear, cycleMonth } = cycleOf(expense);
      return isCharged(expense.id, cycleYear, cycleMonth);
    }),
    amountOf
  );
  return { total, paid, unpaid: total - paid, charged };
}
