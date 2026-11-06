import dayjs from "dayjs";
import { sumBy } from "@/utils/collections";
import { hasCycleIn } from "@/utils/dateHelpers";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { cycleTotals } from "@/utils/expenses/billProgress";
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
  const { expenses, resolveAmount, getMonthStatus, getDisplayAmount } = useExpenses();
  const { getCardBills, isCardCharge, isCharged, isCardAccount, isTxnCharged, getPayments, transactions } = useAccounts();

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
  const inMonth = expenses.filter(isInMonth);
  const cycles = inMonth
    .filter((e) => e.recurrence !== "one-off")
    .map((e) =>
      cycleTotals({
        isPaid: getMonthStatus(e.id, year, month) === "paid",
        bill: getDisplayAmount(e, year, month),
        payments: getPayments(e.id, year, month).map((t) => ({
          amount: Math.abs(t.amount),
          isCard: isCardAccount(t.accountId),
          isCharged: isTxnCharged(t),
        })),
        isCardWithoutRows: isCardAccount(e.accountId),
      })
    );
  const oneOffs = inMonth
    .filter((e) => e.recurrence === "one-off")
    .map((e) => ({
      expense: e,
      status: getMonthStatus(e.id, year, month),
      isCard: isCardCharge(e.id, null, null, e.accountId),
    }));
  // A paid card charge is counted through its card bill instead, so it isn't counted twice.
  const counted = oneOffs.filter(({ isCard, status }) => !isCard || status === "unpaid");
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

  const total = sumBy(counted, amountOf) + sumBy(cycles, "total") + sumBy(bills, (b) => b.amount) + fees;
  const paid =
    sumBy(counted.filter(({ status }) => status === "paid"), amountOf) +
    sumBy(cycles, "paid") +
    sumBy(bills, (b) => Math.min(b.paid, b.amount)) +
    fees;
  const charged =
    sumBy(
      oneOffs.filter(({ expense, isCard, status }) => isCard && status === "paid" && isCharged(expense.id, null, null)),
      amountOf
    ) + sumBy(cycles, "charged");
  return { total, paid, unpaid: total - paid, charged };
}
