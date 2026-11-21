import { useMemo } from "react";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { useToday } from "@/utils/useToday";
import { buildForecast, type Forecast } from "@/utils/forecast/buildForecast";
import { useLowBalanceThreshold } from "@/utils/forecast/useLowBalanceThreshold";

// The balance forecast `days` ahead, from the live expenses, accounts and the Settings threshold (₱0 when unset).
export function useForecast(days: number): Forecast & { today: Date } {
  const { expenses, getMonthStatus, getBillProgress } = useExpenses();
  const { activeAccounts, getBalance, getCardBills } = useAccounts();
  const threshold = useLowBalanceThreshold();
  const today = useToday();

  const forecast = useMemo(
    () =>
      buildForecast({
        expenses,
        getMonthStatus,
        getBillProgress,
        getCardBills,
        activeAccounts,
        getBalance,
        generalThreshold: threshold ?? 0,
        today,
        days,
      }),
    [expenses, getMonthStatus, getBillProgress, getCardBills, activeAccounts, getBalance, threshold, today, days]
  );

  return { ...forecast, today };
}
