import type { HomeEntry } from "@/components/HomeExpenseSections";
import type { Account, Expense } from "@/types";
import type { BillProgress } from "@/utils/expenses/billProgress";
import { buildUpcomingBillsSnapshot } from "@/utils/widget/upcomingBillsSnapshot";

// The snapshot the widget stores, as JSON: the app and the widget's midnight refresh both publish this.
export function upcomingBillsJson({
  overdue,
  upcoming,
  getBillProgress,
  accounts,
}: {
  overdue: readonly HomeEntry[];
  upcoming: readonly HomeEntry[];
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  accounts: readonly Account[];
}): string {
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  return JSON.stringify(
    buildUpcomingBillsSnapshot({
      overdue,
      upcoming,
      getBillProgress,
      accountNameOf: (id) => nameById.get(id),
    })
  );
}
