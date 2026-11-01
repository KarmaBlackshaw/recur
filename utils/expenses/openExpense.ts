import { router } from "expo-router";
import type { Expense } from "@/types";

export function openExpense(expense: Expense, year: number, month: number) {
  if (expense.recurrence === "one-off") {
    router.push({ pathname: "/expense/add", params: { id: expense.id } });
    return;
  }
  router.push({ pathname: "/expense/[id]", params: { id: expense.id, year, month } });
}
