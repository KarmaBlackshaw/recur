import { getDB } from "@/db/schema";
import type { MonthStatus, Status } from "@/types";

export async function getAll(): Promise<MonthStatus[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    expenseId: string; year: number; month: number; status: string; amount: number | null; paidAt: string | null;
  }>(
    "SELECT expense_id as expenseId, year, month, status, amount, paid_at as paidAt FROM expense_months"
  );
  return rows.map((r) => ({
    expenseId: r.expenseId,
    year: r.year,
    month: r.month,
    status: r.status as Status,
    amount: r.amount,
    paidAt: r.paidAt ?? null,
  }));
}

// Writes a month's status, amount and pay time together: paying records what the month cost, so the
// amount stays put when the expense is edited later.
export async function setMonth(
  expenseId: string,
  year: number,
  month: number,
  status: Status,
  amount: number | null,
  paidAt: string | null
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
    [expenseId, year, month, status, amount, paidAt]
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
    `INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount, paid_at)
     VALUES (?, ?, ?,
       COALESCE((SELECT status FROM expense_months WHERE expense_id=? AND year=? AND month=?), 'unpaid'),
       ?,
       (SELECT paid_at FROM expense_months WHERE expense_id=? AND year=? AND month=?))`,
    [expenseId, year, month, expenseId, year, month, amount, expenseId, year, month]
  );
}

export async function insertOrIgnore(m: MonthStatus): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR IGNORE INTO expense_months (expense_id, year, month, status, amount, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
    [m.expenseId, m.year, m.month, m.status, m.amount ?? null, m.paidAt ?? null]
  );
}
