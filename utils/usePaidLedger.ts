import { useMemo } from "react";
import dayjs from "dayjs";
import { useExpenses } from "../context/ExpenseContext";
import { effectivePaidDate } from "./dateHelpers";
import { monthKey } from "./monthKey";
import type { Expense } from "../types";

export interface PaidEntry {
  key: string;
  expense: Expense;
  refDate: Date; // the cycle's due month — drives ExpenseCard amount resolution + edit nav
  effDate: Date; // when it counts (pay date) — drives grouping/window/sort
  amount: number;
}

// Every paid entry across all time — recurring cycles (dated by pay-date) + paid
// one-offs. The single source both the Home "Recently Paid" and Expenses "Paid"
// lists derive from, so advance payments and the legacy NULL-`paid_at` fallback
// resolve identically on every screen. Callers apply their own filter (Home = a
// rolling last-N-day window; Expenses = the whole selected month) over `effDate`.
export function usePaidLedger(): PaidEntry[] {
  const { expenses, paidCycles, getMonthAmount } = useExpenses();

  return useMemo(() => {
    const byId = new Map(expenses.map((e) => [e.id, e]));
    const items: PaidEntry[] = [];

    // One-offs: paid, dated by paidDate (fallback createdAt for legacy rows).
    for (const e of expenses) {
      if (e.recurrence !== "one-off" || e.status !== "paid") continue;
      const created = new Date(e.createdAt);
      items.push({
        key: e.id,
        expense: e,
        refDate: created,
        effDate: e.paidDate ? dayjs(e.paidDate).toDate() : created,
        amount: e.amount ?? 0,
      });
    }

    // Recurring: every paid cycle, dated by its effective pay-date so an advance
    // payment surfaces in the month it was paid, not the due month.
    for (const c of paidCycles) {
      const e = byId.get(c.expenseId);
      if (!e || e.recurrence === "one-off") continue;
      items.push({
        key: monthKey(e.id, c.year, c.month),
        expense: e,
        refDate: new Date(c.year, c.month, 1),
        effDate: effectivePaidDate(c.paidAt, e.dueDay, c.year, c.month),
        amount: e.isVariable ? (getMonthAmount(e.id, c.year, c.month) ?? 0) : (e.amount ?? 0),
      });
    }

    items.sort((a, b) => b.effDate.getTime() - a.effDate.getTime());
    return items;
  }, [expenses, paidCycles, getMonthAmount]);
}
