import { useMemo } from "react";
import { sumBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";

export interface OwedToYou {
  total: number;
  people: number;
}

// What people still owe you on open loans. Null while loans load or once nobody owes anything.
export function useOwedToYou(): OwedToYou | null {
  const { loans, summaries, isLoading } = useLoans();

  return useMemo(() => {
    if (isLoading) {
      return null;
    }
    const open = loans.flatMap((loan) => {
      const summary = summaries[loan.id];
      return summary == null || summary.isSettled ? [] : [{ borrower: loan.borrower, balance: summary.balance }];
    });
    if (open.length === 0) {
      return null;
    }
    return { total: sumBy(open, "balance"), people: new Set(open.map(({ borrower }) => borrower)).size };
  }, [loans, summaries, isLoading]);
}
