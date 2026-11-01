import { useMemo } from "react";
import { sumBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { ActivityFeed } from "@/utils/useActivityFeed";
import type { ActivitySegment, TransactionKind } from "@/types";

export function useMonthActivity(feed: ActivityFeed, year: number, month: number) {
  const { isCharged, transactions } = useAccounts();

  return useMemo(() => {
    const isInMonth = ({ effDate }: { effDate: Date }) => effDate.getFullYear() === year && effDate.getMonth() === month;
    const charged = feed.charged.filter(isInMonth);
    const notPaidOff = sumBy(
      charged.filter(({ expense, refDate }) =>
        expense.recurrence === "one-off"
          ? isCharged(expense.id, null, null)
          : isCharged(expense.id, refDate.getFullYear(), refDate.getMonth())
      ),
      "amount"
    );
    const monthTxnTotal = (kind: TransactionKind) =>
      sumBy(
        transactions.filter((t) => t.kind === kind).map((t) => ({ effDate: new Date(t.createdAt), amount: Math.abs(t.amount) })).filter(isInMonth),
        "amount"
      );
    const fees = monthTxnTotal("fee");
    const transfers = feed.transfers.filter(isInMonth);
    const loans = feed.loans.filter(isInMonth);
    const byFilter: Record<ActivitySegment, ActivityEntry[]> = {
      all: feed.all.filter(isInMonth),
      paid: feed.paid.filter(isInMonth),
      charged,
      income: feed.income.filter(isInMonth),
      transfers,
      loans,
    };
    const transferIncome = sumBy(transfers, "earned");
    return {
      byFilter,
      notPaidOff,
      fees,
      transferIncome,
      lent: sumBy(loans.filter(({ loanTxn }) => loanTxn.kind === "loan_out"), "amount"),
      repaid: sumBy(loans.filter(({ loanTxn }) => loanTxn.kind === "loan_in"), "amount"),
      moneyIn: sumBy(byFilter.income, "amount") + transferIncome,
      paidTotal: sumBy(byFilter.paid, "amount") + fees,
      chargedTotal: sumBy(charged, "amount"),
    };
  }, [feed, transactions, isCharged, year, month]);
}
