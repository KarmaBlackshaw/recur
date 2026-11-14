import type { MonthStatus, Status } from "@/types";
import { monthKey } from "@/utils/monthKey";

export interface MonthMaps {
  monthStatuses: Record<string, Status>;
  monthAmounts: Record<string, number | null>;
  monthPaidAts: Record<string, string | null>;
}

// The stored expense-months, keyed by `monthKey`.
export function monthMaps(rows: MonthStatus[]): MonthMaps {
  const monthStatuses: Record<string, Status> = {};
  const monthAmounts: Record<string, number | null> = {};
  const monthPaidAts: Record<string, string | null> = {};
  for (const m of rows) {
    const k = monthKey(m.expenseId, m.year, m.month);
    monthStatuses[k] = m.status;
    if (m.amount !== undefined) {
      monthAmounts[k] = m.amount;
    }
    monthPaidAts[k] = m.paidAt ?? null;
  }
  return { monthStatuses, monthAmounts, monthPaidAts };
}
