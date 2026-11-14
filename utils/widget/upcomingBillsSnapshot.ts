import dayjs from "dayjs";
import { sortBy } from "@/utils/collections";
import { categoryIcon } from "@/utils/categories";
import { expenseTitle } from "@/utils/expenseHelpers";
import { formatAmount } from "@/utils/formatAmount";
import { formatBillAmount } from "@/utils/expenses/formatBillAmount";
import { isBillTbd } from "@/utils/cardBills";
import { billWidgetLink, cardWidgetLink } from "@/constants/widgetLinks";
import type { HomeEntry } from "@/components/HomeExpenseSections";
import type { BillProgress } from "@/utils/expenses/billProgress";
import type { Expense } from "@/types";

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_ROW_LIMIT = 40;

// Read by UpcomingBillsWidgetService.kt: keep the field names in step.
// `tone` is the tone when the bill isn't late; the widget switches to negative once `due` is before today.
export interface UpcomingBillsRow {
  key: string;
  kind: "expense" | "cardBill";
  title: string;
  meta: string;
  amount: string;
  paid: string | null;
  icon: string;
  due: string;
  tone: "neutral" | "accent";
  link: string;
}

export interface UpcomingBillsSnapshot {
  v: typeof SNAPSHOT_VERSION;
  rows: UpcomingBillsRow[];
}

const DUE_FORMAT = "YYYY-MM-DD";
const META_SEPARATOR = " · ";

// Overdue then upcoming, each by due date: the same rows and text the Home list shows for them.
export function buildUpcomingBillsSnapshot({
  overdue,
  upcoming,
  getBillProgress,
  accountNameOf,
}: {
  overdue: readonly HomeEntry[];
  upcoming: readonly HomeEntry[];
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  accountNameOf: (accountId: string) => string | undefined;
}): UpcomingBillsSnapshot {
  const toRow = (entry: HomeEntry): UpcomingBillsRow | null => {
    const due = dayjs(entry.effDate).format(DUE_FORMAT);
    if (entry.kind === "cardBill") {
      const { bill } = entry;
      const isPartial = bill.paid > 0 && !bill.isPaid;
      return {
        key: entry.key,
        kind: "cardBill",
        title: `${bill.account.name} bill`,
        meta: [bill.isEstimate ? "Estimated" : null, isPartial ? `${formatAmount(bill.remaining)} left` : null]
          .filter(Boolean)
          .join(META_SEPARATOR),
        amount: isBillTbd(bill) ? "TBD" : formatAmount(bill.amount),
        paid: null,
        icon: "credit-card",
        due,
        tone: "accent",
        link: cardWidgetLink(bill.account.id),
      };
    }
    if (entry.kind !== "expense") {
      return null;
    }
    const { expense } = entry;
    const year = entry.refDate.getFullYear();
    const month = entry.refDate.getMonth();
    const progress = getBillProgress(expense, year, month);
    const isPartPaid = progress.paid > 0;
    const title = expenseTitle(expense);
    const accountName = expense.accountId ? accountNameOf(expense.accountId) : undefined;
    return {
      key: entry.key,
      kind: "expense",
      title,
      meta: [title === expense.category ? null : expense.category, accountName].filter(Boolean).join(META_SEPARATOR),
      amount: formatBillAmount(isPartPaid ? progress.left : progress.bill),
      paid: isPartPaid ? `${formatAmount(progress.paid)} paid` : null,
      icon: categoryIcon(expense.category),
      due,
      tone: "neutral",
      link: billWidgetLink(expense.id, year, month),
    };
  };

  const byDue = (entries: readonly HomeEntry[]) =>
    sortBy(
      entries.flatMap((entry) => toRow(entry) ?? []),
      ["due", "key"]
    );

  return { v: SNAPSHOT_VERSION, rows: [...byDue(overdue), ...byDue(upcoming)].slice(0, SNAPSHOT_ROW_LIMIT) };
}
