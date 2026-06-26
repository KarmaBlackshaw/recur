import { getDB } from "./schema";
import type { Expense, Status } from "../types";

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: string; name: string; category: string; amount: number | null;
    dueDay: number; recurrence: string; status: string; is_variable: number;
    reminder_days_before: number | null; notes: string | null; createdAt: string;
    paid_date: string | null;
  }>(
    "SELECT id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date FROM expenses ORDER BY dueDay ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: r.amount,
    dueDay: r.dueDay,
    recurrence: r.recurrence as Expense["recurrence"],
    status: r.status as Status,
    isVariable: r.is_variable === 1,
    reminderDaysBefore: r.reminder_days_before ?? null,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
    paidDate: r.paid_date ?? null,
  }));
}

export async function insert(
  e: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const db = await getDB();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  // Regular (one-off) expenses represent money already spent → auto-paid.
  const status: Status = e.recurrence === "one-off" ? "paid" : (e.status ?? "unpaid");
  // One-offs carry a paid date (defaults to today); recurring never do.
  const paidDate: string | null =
    e.recurrence === "one-off" ? (e.paidDate ?? createdAt) : null;
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, createdAt, paidDate]
  );
  return { ...e, id, createdAt, status, paidDate };
}

export async function insertWithId(e: Expense): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR IGNORE INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.createdAt, e.paidDate ?? null]
  );
}

export async function updateStatus(
  id: string,
  status: Status
): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE expenses SET status = ? WHERE id = ?", [status, id]);
}

export async function update(
  id: string,
  e: Omit<Expense, "id" | "createdAt">
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE expenses SET name=?, category=?, amount=?, dueDay=?, recurrence=?, status=?, is_variable=?, reminder_days_before=?, notes=?, paid_date=? WHERE id=?`,
    [e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.recurrence === "one-off" ? (e.paidDate ?? null) : null, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}
