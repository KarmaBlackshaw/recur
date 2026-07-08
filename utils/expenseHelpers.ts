import type { Expense } from "../types";

/**
 * Display title for an expense. Notes replaced the old `name` field, so notes is
 * the title. Falls back to the legacy `name` (older rows / pre-migration) and then
 * a placeholder so cards and notifications never render a blank title.
 */
export function expenseTitle(expense: Pick<Expense, "name" | "notes">): string {
  return expense.notes?.trim() || expense.name?.trim() || "Untitled";
}
