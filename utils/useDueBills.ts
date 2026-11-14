import { useMemo } from "react";
import dayjs from "dayjs";
import { range } from "@/utils/collections";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import type { DayEntry } from "@/components/DayGroupedExpenseList";
import type { BillEntry, HomeEntry } from "@/components/HomeExpenseSections";
import { isOverdueOn, hasCycleIn, getDueDateForMonth } from "@/utils/dateHelpers";
import { openCardBills } from "@/utils/cardBills";
import { monthKey } from "@/utils/monthKey";
import { useToday } from "@/utils/useToday";

// How many months back an unpaid due or card bill stays in Overdue after its own month has ended.
export const OVERDUE_LOOKBACK_MONTHS = 3;

// Unpaid recurring cycles and open card bills, split by urgency, unsorted and with no lingering paid rows:
// Home's Overdue / Upcoming and the home-screen widget both build on these.
export function useDueBills(): { overdue: HomeEntry[]; upcoming: HomeEntry[]; openBills: BillEntry[]; today: Date } {
  const { expenses, getMonthStatus, getBillProgress } = useExpenses();
  const accounts = useAccounts();
  const today = useToday();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Keyed per cycle: near month end the same expense can be due in both Upcoming months.
  // Every due row can be paid in place (the bill sheet and the Pay swipe).
  const dueEntry = (e: (typeof expenses)[number], y: number, m: number): DayEntry => ({
    kind: "expense",
    key: monthKey(e.id, y, m),
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, y, m),
    refDate: new Date(y, m, 1),
    amount: getBillProgress(e, y, m).left ?? 0,
    canOpenBillSheet: true,
  });

  // Next month too: a new card's first bill is due next month.
  const openBills = useMemo(
    () =>
      openCardBills(accounts.getCardBills, today, OVERDUE_LOOKBACK_MONTHS).map((b): BillEntry => ({
        kind: "cardBill",
        key: `bill-${b.account.id}-${b.year}-${b.month}`,
        bill: b,
        effDate: b.dueDate,
        amount: b.remaining,
      })),
    [accounts.getCardBills, today]
  );

  const overdue = useMemo<HomeEntry[]>(() => {
    // A missed due stays here after its month ends, and so does a card bill until it's paid.
    const entries = range(OVERDUE_LOOKBACK_MONTHS + 1).flatMap((monthsBack) => {
      const at = dayjs(today).subtract(monthsBack, "month");
      const [y, m] = [at.year(), at.month()];
      return expenses
        .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid" && isOverdueOn(e.dueDay, y, m))
        .map((e) => dueEntry(e, y, m));
    });
    const bills = openBills.filter((b) => !b.bill.isPaid && b.effDate < today);
    return [...entries, ...bills];
  }, [expenses, getMonthStatus, getBillProgress, year, month, openBills, today]);

  const upcoming = useMemo<HomeEntry[]>(() => {
    const next = dayjs(today).add(1, "month").startOf("month");
    const unpaidDues = (y: number, m: number) =>
      expenses
        .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid")
        .map((e) => dueEntry(e, y, m));
    return [
      ...unpaidDues(year, month).filter((d) => d.effDate >= today),
      ...openBills.filter((b) => b.effDate >= today && dayjs(b.effDate).isSame(today, "month")),
      ...unpaidDues(next.year(), next.month()),
      ...openBills.filter((b) => dayjs(b.effDate).isSame(next, "month")),
    ];
  }, [expenses, getMonthStatus, getBillProgress, year, month, openBills, today]);

  return { overdue, upcoming, openBills, today };
}
