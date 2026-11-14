import dayjs from "dayjs";
import type { CardBill, Expense, Status } from "@/types";
import type { DayEntry } from "@/components/DayGroupedExpenseList";
import type { BillEntry, HomeEntry } from "@/components/HomeExpenseSections";
import { range } from "@/utils/collections";
import { isOverdueOn, hasCycleIn, getDueDateForMonth } from "@/utils/dateHelpers";
import { openCardBills } from "@/utils/cardBills";
import type { BillProgress } from "@/utils/expenses/billProgress";
import { monthKey } from "@/utils/monthKey";

// How many months back an unpaid due or card bill stays in Overdue after its own month has ended.
export const OVERDUE_LOOKBACK_MONTHS = 3;

export interface DueBills {
  overdue: HomeEntry[];
  upcoming: HomeEntry[];
  openBills: BillEntry[];
}

// Unpaid recurring cycles and open card bills, split by urgency, unsorted and with no lingering paid rows.
// Pure over the lookups, so the app (`useDueBills`) and the widget's headless refresh build the same list.
export function computeDueBills({
  expenses,
  getMonthStatus,
  getBillProgress,
  getCardBills,
  today,
}: {
  expenses: Expense[];
  getMonthStatus: (id: string, year: number, month: number) => Status;
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  getCardBills: (year: number, month: number) => CardBill[];
  today: Date;
}): DueBills {
  const year = today.getFullYear();
  const month = today.getMonth();

  // Keyed per cycle: near month end the same expense can be due in both Upcoming months.
  // Every due row can be paid in place (the bill sheet and the Pay swipe).
  const dueEntry = (e: Expense, y: number, m: number): DayEntry => ({
    kind: "expense",
    key: monthKey(e.id, y, m),
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, y, m),
    refDate: new Date(y, m, 1),
    amount: getBillProgress(e, y, m).left ?? 0,
    canOpenBillSheet: true,
  });

  // Next month too: a new card's first bill is due next month.
  const openBills = openCardBills(getCardBills, today, OVERDUE_LOOKBACK_MONTHS).map((b): BillEntry => ({
    kind: "cardBill",
    key: `bill-${b.account.id}-${b.year}-${b.month}`,
    bill: b,
    effDate: b.dueDate,
    amount: b.remaining,
  }));

  // A missed due stays here after its month ends, and so does a card bill until it's paid.
  const overdueDues = range(OVERDUE_LOOKBACK_MONTHS + 1).flatMap((monthsBack) => {
    const at = dayjs(today).subtract(monthsBack, "month");
    const [y, m] = [at.year(), at.month()];
    return expenses
      .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid" && isOverdueOn(e.dueDay, y, m))
      .map((e) => dueEntry(e, y, m));
  });
  const overdue: HomeEntry[] = [...overdueDues, ...openBills.filter((b) => !b.bill.isPaid && b.effDate < today)];

  const next = dayjs(today).add(1, "month").startOf("month");
  const unpaidDues = (y: number, m: number) =>
    expenses
      .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid")
      .map((e) => dueEntry(e, y, m));
  const upcoming: HomeEntry[] = [
    ...unpaidDues(year, month).filter((d) => d.effDate >= today),
    ...openBills.filter((b) => b.effDate >= today && dayjs(b.effDate).isSame(today, "month")),
    ...unpaidDues(next.year(), next.month()),
    ...openBills.filter((b) => dayjs(b.effDate).isSame(next, "month")),
  ];

  return { overdue, upcoming, openBills };
}
