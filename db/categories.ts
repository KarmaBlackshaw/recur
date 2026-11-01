import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import { isLockedCategory, lockedLast } from "@/utils/categories";
import type { CategoryKind } from "@/types";

export interface Category {
  id: number; // SQLite rowid — unique integer per row, not derived from the name
  name: string;
}

// Categories are ordered by recency: most-recently-used first, never-used last
// (sort_order is the stable tiebreak for the never-used group → keeps preset order). The locked categories always go last.
const RECENCY_ORDER = "ORDER BY last_used_at IS NULL ASC, last_used_at DESC, sort_order ASC";

export async function getAll(kind: CategoryKind = "expense"): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM categories WHERE kind = ? ${RECENCY_ORDER}`,
    [kind]
  );
  return lockedLast(
    rows.map((r) => r.name),
    kind
  );
}

export async function getAllWithIds(kind: CategoryKind = "expense"): Promise<Category[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Category>(
    `SELECT rowid AS id, name FROM categories WHERE kind = ? ${RECENCY_ORDER}`,
    [kind]
  );
  return lockedLast(rows, kind);
}

interface TTouchCategoryOptions {
  name: string;
  kind?: CategoryKind;
  at?: string;
  db?: SQLiteDatabase;
}

// Bump a category's recency. Called whenever an expense is saved with this category.
export async function touchCategory({
  name,
  kind = "expense",
  at = new Date().toISOString(),
  db,
}: TTouchCategoryOptions): Promise<void> {
  const conn = db ?? (await getDB());
  await conn.runAsync("UPDATE categories SET last_used_at = ? WHERE name = ? AND kind = ?", [at, name, kind]);
}

// Pass a transaction as `db` to insert inside it. Returns 1 when added, 0 when the category already existed.
export async function insertCategory(
  name: string,
  kind: CategoryKind = "expense",
  db?: SQLiteDatabase
): Promise<number> {
  const conn = db ?? (await getDB());
  const row = await conn.getFirstAsync<{ max_order: number }>(
    "SELECT MAX(sort_order) as max_order FROM categories WHERE kind = ?",
    [kind]
  );
  const nextOrder = (row?.max_order ?? -1) + 1;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await conn.runAsync(
    "INSERT OR IGNORE INTO categories (id, name, sort_order, kind) VALUES (?, ?, ?, ?)",
    [id, name, nextOrder, kind]
  );
  return result.changes;
}

// Expenses and income store the category by name, so the rename cascades to every row using it.
export async function renameCategory(id: number, newName: string): Promise<void> {
  const db = await getDB();
  await withWriteTransaction(db, async (txn) => {
    const row = await txn.getFirstAsync<{ name: string; kind: CategoryKind }>(
      "SELECT name, kind FROM categories WHERE rowid = ?",
      [id]
    );
    if (!row) {
      return;
    }
    if (isLockedCategory(row.name, row.kind)) {
      throw new Error(`${row.name} can't be renamed`);
    }
    await txn.runAsync("UPDATE categories SET name = ? WHERE rowid = ?", [newName, id]);
    if (row.kind === "income") {
      await txn.runAsync(
        "UPDATE account_transactions SET category = ? WHERE kind = 'income' AND category = ?",
        [newName, row.name]
      );
    } else {
      await txn.runAsync("UPDATE expenses SET category = ? WHERE category = ?", [newName, row.name]);
    }
  });
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ name: string; kind: CategoryKind }>(
    "SELECT name, kind FROM categories WHERE rowid = ?",
    [id]
  );
  if (row && isLockedCategory(row.name, row.kind)) {
    throw new Error(`${row.name} can't be deleted`);
  }
  await db.runAsync("DELETE FROM categories WHERE rowid = ?", [id]);
}
