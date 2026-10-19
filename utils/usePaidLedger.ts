import { useMemo } from "react";
import dayjs from "dayjs";
import keyBy from "lodash/keyBy";
import orderBy from "lodash/orderBy";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { effectivePaidDate } from "@/utils/dateHelpers";
import { monthKey } from "@/utils/monthKey";
import type { Account, AccountTransaction, Expense } from "@/types";

export interface PaidEntry {
  key: string;
  expense: Expense;
  refDate: Date; // the cycle's due month — drives ExpenseCard amount resolution + edit nav
  effDate: Date; // when it counts (pay date) — drives grouping/window/sort
  amount: number;
  isCard: boolean;
}

export interface BillPaymentEntry {
  key: string;
  payment: AccountTransaction;
  account: Account;
  sourceName: string | undefined;
  effDate: Date;
  amount: number;
}

// Every paid entry across all time — recurring cycles (dated by pay-date) + paid
// one-offs. The single source both the Home "Recently Paid" and Expenses "Paid"
// lists derive from, so advance payments and the legacy NULL-`paid_at` fallback
// resolve identically on every screen. Callers apply their own filter (Home = a
// rolling last-N-day window; Expenses = the whole selected month) over `effDate`.
export function usePaidLedger(): PaidEntry[] {
  const { expenses, paidCycles, resolveAmount } = useExpenses();
  const { isCardCharge } = useAccounts();

  return useMemo(() => {
    const byId = keyBy(expenses, "id");
    const items: PaidEntry[] = [];

    // One-offs: paid, dated by paidDate (fallback createdAt for legacy rows).
    for (const e of expenses) {
      if (e.recurrence !== "one-off" || e.status !== "paid") {
        continue;
      }
      const created = new Date(e.createdAt);
      items.push({
        key: e.id,
        expense: e,
        refDate: created,
        effDate: e.paidDate ? dayjs(e.paidDate).toDate() : created,
        amount: e.amount ?? 0,
        isCard: isCardCharge(e.id, null, null, e.accountId),
      });
    }

    // Recurring: every paid cycle, dated by its effective pay-date so an advance
    // payment surfaces in the month it was paid, not the due month.
    for (const c of paidCycles) {
      const e = byId[c.expenseId];
      if (!e || e.recurrence === "one-off") {
        continue;
      }
      items.push({
        key: monthKey(e.id, c.year, c.month),
        expense: e,
        refDate: new Date(c.year, c.month, 1),
        effDate: effectivePaidDate(c.paidAt, e.dueDay, c.year, c.month),
        amount: resolveAmount(e, c.year, c.month),
        isCard: isCardCharge(e.id, c.year, c.month, e.accountId),
      });
    }

    return orderBy(items, "effDate", "desc");
  }, [expenses, paidCycles, resolveAmount, isCardCharge]);
}

export function useBillPayments(): BillPaymentEntry[] {
  const { accounts, transactions, isCardAccount } = useAccounts();

  return useMemo(() => {
    const accountsById = keyBy(accounts, "id");
    const items: BillPaymentEntry[] = [];

    for (const t of transactions) {
      if (t.kind !== "transfer" || t.amount >= 0 || !isCardAccount(t.accountId)) {
        continue;
      }
      const account = accountsById[t.accountId];
      if (!account) {
        continue;
      }
      const source = transactions.find((o) => t.transferId != null && o.transferId === t.transferId && o.id !== t.id);
      items.push({
        key: t.id,
        payment: t,
        account,
        sourceName: source ? accountsById[source.accountId]?.name : undefined,
        effDate: dayjs(t.createdAt).toDate(),
        amount: Math.abs(t.amount),
      });
    }

    return orderBy(items, "effDate", "desc");
  }, [accounts, transactions, isCardAccount]);
}
