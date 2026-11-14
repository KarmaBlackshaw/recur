import dayjs from "dayjs";
import { getAll as getAllAccounts } from "@/db/accounts";
import { getAll as getAllTransactions } from "@/db/accountTransactions";
import { getAll as getAllCardBills } from "@/db/cardBills";
import { getAll as getAllExpenses } from "@/db/expenses";
import { getAll as getAllMonths } from "@/db/expenseMonths";
import { setUpcomingBillsSnapshot } from "@/modules/upcoming-bills-widget";
import type { Expense } from "@/types";
import { cardBillsFor } from "@/utils/accounts/cardBillsFor";
import { paymentLookup } from "@/utils/accounts/paymentLookup";
import { keyBy } from "@/utils/collections";
import { computeDueBills } from "@/utils/computeDueBills";
import { billProgressOf } from "@/utils/expenses/billProgressOf";
import { monthMaps } from "@/utils/expenses/monthMaps";
import { monthStatusOf } from "@/utils/expenses/monthStatusOf";
import { inEffectTransactions } from "@/utils/reversals/inEffectTransactions";
import { upcomingBillsJson } from "@/utils/widget/upcomingBillsJson";

// The widget's midnight headless task: rebuilds Home's due rows from the database and republishes them,
// so the widget picks up a new month's cycles and card statements while Recur isn't running.
// On failure the widget keeps its last snapshot.
export async function refreshUpcomingBillsWidget(): Promise<void> {
  try {
    const [expenses, monthRows, accounts, ledger, billOverrides] = await Promise.all([
      getAllExpenses(),
      getAllMonths(),
      getAllAccounts(),
      getAllTransactions(),
      getAllCardBills(),
    ]);
    const transactions = inEffectTransactions(ledger);
    const { monthStatuses, monthAmounts } = monthMaps(monthRows);
    const monthLedger = { monthStatuses, monthAmounts, getPayments: paymentLookup(transactions) };
    const expensesById = keyBy(expenses, "id");
    const getBillProgress = (expense: Expense, year: number, month: number) =>
      billProgressOf(expense, year, month, monthLedger);
    const { overdue, upcoming } = computeDueBills({
      expenses,
      getMonthStatus: (id, year, month) => monthStatusOf({ expense: expensesById[id], year, month, monthStatuses }),
      getBillProgress,
      getCardBills: (year, month) =>
        cardBillsFor({ accounts, transactions, billOverrides, year, month, now: new Date() }),
      today: dayjs().startOf("day").toDate(),
    });
    await setUpcomingBillsSnapshot(upcomingBillsJson({ overdue, upcoming, getBillProgress, accounts }));
  } catch (error) {
    console.error("Upcoming bills widget refresh failed", error);
  }
}
