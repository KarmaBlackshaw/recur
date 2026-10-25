import { useMemo } from "react";
import round from "lodash/round";
import sumBy from "lodash/sumBy";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";

export interface NetWorth {
  assets: number;
  lent: number;
  owed: number;
  net: number;
}

// Account balances plus what people still owe you (the open loan balances Home shows as "Owed to you"), minus
// what's owed on cards. Lending moves money from an account into "lent", so it no longer reads as a loss.
export function useNetWorth(): NetWorth {
  const { netWorth } = useAccounts();
  const { loans, summaries } = useLoans();

  return useMemo(() => {
    const lent = round(
      sumBy(loans, ({ id }) => {
        const summary = summaries[id];
        return summary == null || summary.isSettled ? 0 : summary.balance;
      }),
      2
    );
    return { assets: netWorth.assets, lent, owed: netWorth.owed, net: round(netWorth.net + lent, 2) };
  }, [netWorth, loans, summaries]);
}
