import { getDB } from "./schema";
import type { MonthStatus, Status } from "../types";

export async function getAll(): Promise<MonthStatus[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    expenseId: string; year: number; month: number; status: string; amount: number | null;
  }>(
    "SELECT expense_id as expenseId, year, month, status, amount FROM expense_months"
  );
  return rows.map((r) => ({
    expenseId: r.expenseId,
    year: r.year,
    month: r.month,
    status: r.status as Status,
    amount: r.amount,
  }));
}

export async function upsertStatus(
  expenseId: string,
  year: number,
  month: number,
  status: Status
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount)
     VALUES (?, ?, ?, ?,
       (SELECT amount FROM expense_months WHERE expense_id=? AND year=? AND month=?))`,
    [expenseId, year, month, status, expenseId, year, month]
  );
}

export async function upsertMonthlyAmount(
  expenseId: string,
  year: number,
  month: number,
  amount: number | null
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount)
     VALUES (?, ?, ?,
       COALESCE((SELECT status FROM expense_months WHERE expense_id=? AND year=? AND month=?), 'unpaid'),
       ?)`,
    [expenseId, year, month, expenseId, year, month, amount]
  );
}

export async function removeForExpense(expenseId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expense_months WHERE expense_id = ?", [expenseId]);
}
