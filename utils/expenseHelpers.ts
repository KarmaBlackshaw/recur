import type { Expense } from "@/types";

/**
 * Display title for an expense. Notes replaced the old `name` field, so notes is
 * the title. Falls back to the legacy `name` (older rows / pre-migration) and then
 * the category so cards never render a blank title.
 */
export function expenseTitle(expense: Pick<Expense, "name" | "notes" | "category">): string {
  return expense.notes?.trim() || expense.name?.trim() || expense.category;
}
