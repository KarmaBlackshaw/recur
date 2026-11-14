import type { Expense, Status } from "@/types";
import { monthKey } from "@/utils/monthKey";

// A one-off keeps its own status; a recurring expense's month is unpaid until stored as paid.
export function monthStatusOf({
  expense,
  year,
  month,
  monthStatuses,
}: {
  expense: Expense | undefined;
  year: number;
  month: number;
  monthStatuses: Record<string, Status>;
}): Status {
  if (!expense) {
    return "unpaid";
  }
  if (expense.recurrence === "one-off") {
    return expense.status;
  }
  return monthStatuses[monthKey(expense.id, year, month)] ?? "unpaid";
}
