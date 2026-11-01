import { useMemo } from "react";
import { orderBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import type { ActivityEntry, DayEntry, LedgerEntry } from "@/components/DayGroupedExpenseList";
import {
  usePaidLedger,
  useBillPayments,
  useTransfers,
  useIncomeEntries,
  useInterestCredits,
  type IncomeEntry,
  type InterestEntry,
  type TransferEntry,
} from "@/utils/usePaidLedger";
import { useLoanActivity, type LoanActivityEntry } from "@/utils/useLoanActivity";

export interface ActivityFeed {
  all: ActivityEntry[];
  paid: LedgerEntry[];
  charged: DayEntry[];
  income: (IncomeEntry | InterestEntry)[];
  transfers: TransferEntry[];
  // Money lent and repaid. Kept out of paid and income: lending moves money you still own (net worth counts it).
  loans: LoanActivityEntry[];
}

// Every activity row across all time, newest first. Home shows the latest
// few, Activity filters to the selected month.
export function useActivityFeed(): ActivityFeed {
  const { transactions } = useAccounts();
  const ledger = usePaidLedger();
  const billPayments = useBillPayments();
  const transfers = useTransfers();
  const loanActivity = useLoanActivity();
  const incomeEntries = useIncomeEntries();
  const interestCredits = useInterestCredits();

  return useMemo(() => {
    const paid = orderBy(
      [
        ...ledger.filter((it) => !it.isCard).map((it) => ({ ...it, compact: true })),
        ...billPayments,
      ],
      "effDate",
      "desc"
    );
    const charged = ledger.filter((it) => it.isCard).map((it) => ({ ...it, compact: true }));
    const liveTransferIds = new Set(transactions.filter((t) => t.kind === "transfer").map((t) => t.transferId));
    const income = orderBy(
      [
        // Income earned on a transfer rides on its TransferRow (like tax on InterestRow), not a row of its own —
        // unless both transfer sides were deleted with their accounts and it sits in a third account.
        ...incomeEntries.filter(({ income }) => income.transferId == null || !liveTransferIds.has(income.transferId)),
        ...interestCredits,
      ],
      "effDate",
      "desc"
    );
    const all = orderBy([...paid, ...charged, ...income, ...transfers, ...loanActivity], "effDate", "desc");
    return { all, paid, charged, income, transfers, loans: loanActivity };
  }, [ledger, billPayments, transfers, loanActivity, incomeEntries, interestCredits, transactions]);
}
