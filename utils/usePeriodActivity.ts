import { useMemo } from "react";
import { sumBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { isInPeriod } from "@/utils/dateHelpers";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { ActivityFeed } from "@/utils/useActivityFeed";
import type { ActivitySegment, Period, TransactionKind } from "@/types";

export function usePeriodActivity(feed: ActivityFeed, year: number, month: number, period: Period) {
  const { isCharged, transactions } = useAccounts();

  return useMemo(() => {
    const inPeriod = ({ effDate }: { effDate: Date }) => isInPeriod(effDate, year, month, period);
    const charged = feed.charged.filter(inPeriod);
    const notPaidOff = sumBy(
      charged.filter(({ expense, refDate }) =>
        expense.recurrence === "one-off"
          ? isCharged(expense.id, null, null)
          : isCharged(expense.id, refDate.getFullYear(), refDate.getMonth())
      ),
      "amount"
    );
    const periodTxnTotal = (kind: TransactionKind) =>
      sumBy(
        transactions.filter((t) => t.kind === kind).map((t) => ({ effDate: new Date(t.createdAt), amount: Math.abs(t.amount) })).filter(inPeriod),
        "amount"
      );
    const fees = periodTxnTotal("fee");
    const transfers = feed.transfers.filter(inPeriod);
    const loans = feed.loans.filter(inPeriod);
    const byFilter: Record<ActivitySegment, ActivityEntry[]> = {
      all: feed.all.filter(inPeriod),
      paid: feed.paid.filter(inPeriod),
      charged,
      income: feed.income.filter(inPeriod),
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
  }, [feed, transactions, isCharged, year, month, period]);
}
