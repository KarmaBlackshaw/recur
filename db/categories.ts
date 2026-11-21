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

interface TCategoryRow {
  name: string;
  kind: CategoryKind;
}

async function getCategoryRow(conn: SQLiteDatabase, id: number): Promise<TCategoryRow | null> {
  return conn.getFirstAsync<TCategoryRow>("SELECT name, kind FROM categories WHERE rowid = ?", [id]);
}

async function countRowsUsing(conn: SQLiteDatabase, { name, kind }: TCategoryRow): Promise<number> {
  const row =
    kind === "income"
      ? await conn.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM account_transactions WHERE kind = 'income' AND category = ?",
          [name]
        )
      : await conn.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM expenses WHERE category = ?", [
          name,
        ]);
  return row?.count ?? 0;
}

// Expenses and income store the category by name, so every row using it follows the move.
async function moveRows(txn: SQLiteDatabase, { name, kind }: TCategoryRow, toName: string): Promise<void> {
  if (kind === "income") {
    await txn.runAsync("UPDATE account_transactions SET category = ? WHERE kind = 'income' AND category = ?", [
      toName,
      name,
    ]);
  } else {
    await txn.runAsync("UPDATE expenses SET category = ? WHERE category = ?", [toName, name]);
  }
}

// How many expenses (or income entries, for an income category) use the category.
export async function countCategoryUses(id: number): Promise<number> {
  const db = await getDB();
  const row = await getCategoryRow(db, id);
  return row ? countRowsUsing(db, row) : 0;
}

export async function renameCategory(id: number, newName: string): Promise<void> {
  const db = await getDB();
  await withWriteTransaction(db, async (txn) => {
    const row = await getCategoryRow(txn, id);
    if (!row) {
      return;
    }
    if (isLockedCategory(row.name, row.kind)) {
      throw new Error(`${row.name} can't be renamed`);
    }
    await txn.runAsync("UPDATE categories SET name = ? WHERE rowid = ?", [newName, id]);
    await moveRows(txn, row, newName);
  });
}

// A category still in use needs `moveTo`, another category of its kind: its rows move there in the same write, so
// none is left naming a category that no longer exists.
export async function deleteCategory(id: number, moveTo?: string): Promise<void> {
  const db = await getDB();
  await withWriteTransaction(db, async (txn) => {
    const row = await getCategoryRow(txn, id);
    if (!row) {
      return;
    }
    if (isLockedCategory(row.name, row.kind)) {
      throw new Error(`${row.name} can't be deleted`);
    }
    if (moveTo == null) {
      if ((await countRowsUsing(txn, row)) > 0) {
        throw new Error(`${row.name} is in use`);
      }
    } else {
      const target = await txn.getFirstAsync<{ name: string }>(
        "SELECT name FROM categories WHERE name = ? AND kind = ? AND rowid != ?",
        [moveTo, row.kind, id]
      );
      if (!target) {
        throw new Error(`Can't move ${row.name} to ${moveTo}`);
      }
      await moveRows(txn, row, moveTo);
    }
    await txn.runAsync("DELETE FROM categories WHERE rowid = ?", [id]);
  });
}
