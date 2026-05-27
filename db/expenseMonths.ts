import { getDB } from "./schema";
import type { MonthStatus, Status } from "../types";

export async function getAll(): Promise<MonthStatus[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ expenseId: string; year: number; month: number; status: string }>(
    "SELECT expense_id as expenseId, year, month, status FROM expense_months"
  );
  return rows.map((r) => ({ ...r, status: r.status as Status }));
}

export async function upsertStatus(
  expenseId: string,
  year: number,
  month: number,
  status: Status
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO expense_months (expense_id, year, month, status) VALUES (?, ?, ?, ?)",
    [expenseId, year, month, status]
  );
}

export async function removeForExpense(expenseId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expense_months WHERE expense_id = ?", [expenseId]);
}
