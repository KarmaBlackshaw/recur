import * as SQLite from "expo-sqlite";
import { getDB } from "./schema";
import type { Expense, Status } from "../types";

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Expense>(
    "SELECT * FROM expenses ORDER BY dueDate ASC"
  );
  return rows;
}

export async function insert(
  e: Omit<Expense, "id" | "createdAt">
): Promise<Expense> {
  const db = await getDB();
  const id = Date.now().toString();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO expenses (id, name, category, amount, dueDate, recurrence, status, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDate, e.recurrence, e.status ?? "unpaid", e.notes ?? null, createdAt]
  );
  return { ...e, id, createdAt, status: e.status ?? "unpaid" };
}

export async function updateStatus(
  id: string,
  status: Status,
  dueDate?: string
): Promise<void> {
  const db = await getDB();
  if (dueDate) {
    await db.runAsync(
      "UPDATE expenses SET status = ?, dueDate = ? WHERE id = ?",
      [status, dueDate, id]
    );
  } else {
    await db.runAsync("UPDATE expenses SET status = ? WHERE id = ?", [status, id]);
  }
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}
