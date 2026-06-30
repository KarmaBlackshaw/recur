import { getDB } from "./schema";
import type { FeatherIconName } from "../types";

export interface Category {
  id: string;
  name: string;
  icon: FeatherIconName;
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
  const rows = await db.getAllAsync<{ id: string; name: string; icon: string }>(
    `SELECT id, name, icon FROM categories ${RECENCY_ORDER}`
  );
  return rows.map((r) => ({ ...r, icon: r.icon as FeatherIconName }));
}

// Bump a category's recency. Called whenever an expense is saved with this category.
export async function touchCategory(
  name: string,
  at: string = new Date().toISOString()
): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET last_used_at = ? WHERE name = ?", [at, name]);
}

export async function insertCategory(name: string, icon: FeatherIconName = "more-horizontal"): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ max_order: number }>(
    "SELECT MAX(sort_order) as max_order FROM categories"
  );
  const nextOrder = (row?.max_order ?? -1) + 1;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    "INSERT OR IGNORE INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)",
    [id, name, icon, nextOrder]
  );
}

export async function renameCategory(id: string, newName: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET name = ? WHERE id = ?", [newName, id]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
}

export async function updateIcon(id: string, icon: FeatherIconName): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET icon = ? WHERE id = ?", [icon, id]);
}
