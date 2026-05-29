import { getDB } from "./schema";
import type { Expense, Status } from "../types";

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: string; name: string; category: string; amount: number | null;
    dueDay: number; recurrence: string; status: string; is_variable: number;
    notes: string | null; createdAt: string;
  }>(
    "SELECT id, name, category, amount, dueDay, recurrence, status, is_variable, notes, createdAt FROM expenses ORDER BY dueDay ASC"
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
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
  }));
}

export async function insert(
  e: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const db = await getDB();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, is_variable, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status ?? "unpaid", e.isVariable ? 1 : 0, e.notes ?? null, createdAt]
  );
  return { ...e, id, createdAt, status: e.status ?? "unpaid" };
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
    `UPDATE expenses SET name=?, category=?, amount=?, dueDay=?, recurrence=?, status=?, is_variable=?, notes=? WHERE id=?`,
    [e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.notes ?? null, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}
