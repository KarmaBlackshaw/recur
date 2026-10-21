import { useMemo } from "react";
import orderBy from "lodash/orderBy";
import { useAccounts } from "@/context/AccountContext";
import type { ActivityEntry, DayEntry, LedgerEntry } from "@/components/DayGroupedExpenseList";
import { usePaidLedger, useBillPayments, useTransfers, type IncomeEntry, type TransferEntry } from "@/utils/usePaidLedger";
import { useLoanActivity, type LoanActivityEntry } from "@/utils/useLoanActivity";

export interface ActivityFeed {
  all: ActivityEntry[];
  paid: (LedgerEntry | LoanActivityEntry)[];
  charged: DayEntry[];
  income: (IncomeEntry | LoanActivityEntry)[];
  transfers: TransferEntry[];
}

// Every activity row across all time, newest first. Home filters it to a rolling
// window, Activity to the selected month.
export function useActivityFeed(): ActivityFeed {
  const { transactions } = useAccounts();
  const ledger = usePaidLedger();
  const billPayments = useBillPayments();
  const transfers = useTransfers();
  const loanActivity = useLoanActivity();

  return useMemo(() => {
    const paid = orderBy(
      [
        ...ledger.filter((it) => !it.isCard).map((it) => ({ ...it, compact: true })),
        ...billPayments,
        ...loanActivity.filter(({ loanTxn }) => loanTxn.kind === "loan_out"),
      ],
      "effDate",
      "desc"
    );
    const charged = ledger.filter((it) => it.isCard).map((it) => ({ ...it, compact: true }));
    const income = orderBy(
      [
        ...transactions
          .filter((t) => t.kind === "income")
          .map((t) => ({ key: t.id, income: t, effDate: new Date(t.createdAt), amount: t.amount })),
        ...loanActivity.filter(({ loanTxn }) => loanTxn.kind === "loan_in"),
      ],
      "effDate",
      "desc"
    );
    const all = orderBy([...paid, ...charged, ...income, ...transfers], "effDate", "desc");
    return { all, paid, charged, income, transfers };
  }, [ledger, billPayments, transfers, loanActivity, transactions]);
}
