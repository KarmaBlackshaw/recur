import { getDB } from "./schema";

export interface Category {
  id: number; // SQLite rowid — unique integer per row, not derived from the name
  name: string;
}

// Categories are ordered by recency: most-recently-used first, never-used last
// (sort_order is the stable tiebreak for the never-used group → keeps preset order).
const RECENCY_ORDER = "ORDER BY last_used_at IS NULL ASC, last_used_at DESC, sort_order ASC";

export async function getAll(): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM categories ${RECENCY_ORDER}`
  );
  return rows.map((r) => r.name);
}

export async function getAllWithIds(): Promise<Category[]> {
  const db = await getDB();
  return db.getAllAsync<Category>(
    `SELECT rowid AS id, name FROM categories ${RECENCY_ORDER}`
  );
}

// Bump a category's recency. Called whenever an expense is saved with this category.
export async function touchCategory(
  name: string,
  at: string = new Date().toISOString()
): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET last_used_at = ? WHERE name = ?", [at, name]);
}

export async function insertCategory(name: string): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ max_order: number }>(
    "SELECT MAX(sort_order) as max_order FROM categories"
  );
  const nextOrder = (row?.max_order ?? -1) + 1;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    "INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)",
    [id, name, nextOrder]
  );
}

export async function renameCategory(id: number, newName: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET name = ? WHERE rowid = ?", [newName, id]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM categories WHERE rowid = ?", [id]);
}
