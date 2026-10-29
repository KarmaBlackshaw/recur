import { useMemo } from "react";
import dayjs from "dayjs";
import { keyBy, orderBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import type { AccountTransaction, Loan } from "@/types";

export interface LoanActivityEntry {
  key: string;
  loanTxn: AccountTransaction;
  loan: Loan | undefined;
  effDate: Date;
  amount: number;
}

export function useLoanActivity(): LoanActivityEntry[] {
  const accounts = useAccounts();
  const loans = useLoans();

  return useMemo(() => {
    const byId = keyBy(loans.loans, "id");
    const items = accounts.transactions
      .filter(({ kind }) => kind === "loan_out" || kind === "loan_in")
      .map((t) => ({
        key: t.id,
        loanTxn: t,
        loan: t.loanId != null ? byId[t.loanId] : undefined,
        effDate: dayjs(t.createdAt).toDate(),
        amount: Math.abs(t.amount),
      }));
    return orderBy(items, "effDate", "desc");
  }, [accounts.transactions, loans.loans]);
}
