import { getDB } from "./schema";
import { touchCategory } from "./categories";
import type { Expense, Status } from "../types";

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: string; name: string; category: string; amount: number | null;
    dueDay: number; recurrence: string; status: string; is_variable: number;
    reminder_days_before: number | null; notes: string | null; createdAt: string;
    paid_date: string | null; end_year: number | null; end_month: number | null;
  }>(
    "SELECT id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date, end_year, end_month FROM expenses ORDER BY dueDay ASC"
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
    endYear: r.end_year ?? null,
    endMonth: r.end_month ?? null,
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
  const endYear = e.recurrence === "one-off" ? null : (e.endYear ?? null);
  const endMonth = e.recurrence === "one-off" ? null : (e.endMonth ?? null);
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date, end_year, end_month)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, createdAt, paidDate, endYear, endMonth]
  );
  await touchCategory(e.category, createdAt);
  return { ...e, id, createdAt, status, paidDate, endYear, endMonth };
}

export async function insertWithId(e: Expense): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR IGNORE INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date, end_year, end_month)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.createdAt, e.paidDate ?? null, e.endYear ?? null, e.endMonth ?? null]
  );
  await touchCategory(e.category, e.createdAt);
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
    `UPDATE expenses SET name=?, category=?, amount=?, dueDay=?, recurrence=?, status=?, is_variable=?, reminder_days_before=?, notes=?, paid_date=?, end_year=?, end_month=? WHERE id=?`,
    [e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.recurrence === "one-off" ? (e.paidDate ?? null) : null, e.recurrence === "one-off" ? null : (e.endYear ?? null), e.recurrence === "one-off" ? null : (e.endMonth ?? null), id]
  );
  await touchCategory(e.category);
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}
