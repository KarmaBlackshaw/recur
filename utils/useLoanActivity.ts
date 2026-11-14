import { useMemo } from "react";
import dayjs from "dayjs";
import { keyBy, orderBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { round } from "@/utils/round";
import type { IncomeEntry } from "@/utils/usePaidLedger";
import type { AccountTransaction, Loan, TRepayment } from "@/types";

export interface LoanActivityEntry {
  kind: "loan";
  key: string;
  loanTxn: AccountTransaction;
  loan: Loan | undefined;
  effDate: Date;
  amount: number;
}

export interface RepaymentActivityEntry {
  kind: "repayment";
  key: string;
  repayment: TRepayment;
  excess: IncomeEntry | undefined;
  effDate: Date;
  amount: number;
}

export type LoanFeedEntry = LoanActivityEntry | RepaymentActivityEntry;

export function useLoanActivity(incomeEntries: readonly IncomeEntry[]): LoanFeedEntry[] {
  const accounts = useAccounts();
  const loans = useLoans();

  return useMemo(() => {
    const byId = keyBy(loans.loans, "id");
    const incomeById = keyBy(incomeEntries, ({ income }) => income.id);
    const lent = accounts.transactions
      .filter(({ kind }) => kind === "loan_out")
      .map((t): LoanActivityEntry => ({
        kind: "loan",
        key: t.id,
        loanTxn: t,
        loan: t.loanId != null ? byId[t.loanId] : undefined,
        effDate: dayjs(t.createdAt).toDate(),
        amount: Math.abs(t.amount),
      }));
    const repaid = loans.repayments.map((repayment): RepaymentActivityEntry => {
      const candidate = repayment.excess != null ? incomeById[repayment.excess.id] : undefined;
      const excess =
        candidate != null && dayjs(candidate.effDate).isSame(dayjs(repayment.paidAt), "day") ? candidate : undefined;
      return {
        kind: "repayment",
        key: `repayment:${repayment.id}`,
        repayment,
        excess,
        effDate: dayjs(repayment.paidAt).toDate(),
        amount: round(repayment.principal + (excess?.amount ?? 0), 2),
      };
    });
    return orderBy<LoanFeedEntry>([...lent, ...repaid], "effDate", "desc");
  }, [accounts.transactions, loans.loans, loans.repayments, incomeEntries]);
}
