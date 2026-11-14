import { useMemo } from "react";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { computeDueBills, type DueBills } from "@/utils/computeDueBills";
import { useToday } from "@/utils/useToday";

// Unpaid recurring cycles and open card bills, split by urgency, unsorted and with no lingering paid rows:
// Home's Overdue / Upcoming and the home-screen widget both build on these.
export function useDueBills(): DueBills & { today: Date } {
  const { expenses, getMonthStatus, getBillProgress } = useExpenses();
  const { getCardBills } = useAccounts();
  const today = useToday();

  const dueBills = useMemo(
    () => computeDueBills({ expenses, getMonthStatus, getBillProgress, getCardBills, today }),
    [expenses, getMonthStatus, getBillProgress, getCardBills, today]
  );

  return { ...dueBills, today };
}
