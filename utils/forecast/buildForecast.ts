import type { Account, CardBill, Expense, Status } from "@/types";
import type { BillProgress } from "@/utils/expenses/billProgress";
import { round } from "@/utils/round";
import { forecastOutflows, type ForecastOutflow } from "@/utils/forecast/forecastOutflows";
import { projectLine, type ForecastLine } from "@/utils/forecast/projectLine";

export interface Forecast {
  days: number;
  total: ForecastLine;
  accounts: (ForecastLine & { account: Account })[];
  outflows: ForecastOutflow[];
  unknownCount: number;
}

// The total of the user's debit and cash accounts and each of them, projected `days` ahead as bills leave.
// A card bill with no Pay bill from lowers the total only. Each account warns below its own threshold, or the
// general one when it has none.
export function buildForecast({
  expenses,
  getMonthStatus,
  getBillProgress,
  getCardBills,
  activeAccounts,
  getBalance,
  generalThreshold,
  today,
  days,
}: {
  expenses: Expense[];
  getMonthStatus: (id: string, year: number, month: number) => Status;
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  getCardBills: (year: number, month: number) => CardBill[];
  activeAccounts: Account[];
  getBalance: (accountId: string) => number;
  generalThreshold: number;
  today: Date;
  days: number;
}): Forecast {
  const { outflows, unknownCount } = forecastOutflows({
    expenses,
    getMonthStatus,
    getBillProgress,
    getCardBills,
    activeAccounts,
    today,
    days,
  });
  const moneyAccounts = activeAccounts.filter((a) => a.type === "debit" || a.type === "cash");

  const accounts = moneyAccounts.map((account) => ({
    account,
    ...projectLine({
      accountId: account.id,
      start: getBalance(account.id),
      outflows: outflows.filter((o) => o.accountId === account.id),
      threshold: account.lowBalanceThreshold ?? generalThreshold,
      today,
      days,
    }),
  }));
  const total = projectLine({
    accountId: null,
    start: round(accounts.reduce((sum, line) => sum + line.start, 0), 2),
    outflows,
    threshold: generalThreshold,
    today,
    days,
  });
  return { days, total, accounts, outflows, unknownCount };
}
