import { getDB } from "./schema";

export interface Category {
  id: string;
  name: string;
}

export async function getAll(): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM categories ORDER BY sort_order ASC"
  );
  return rows.map((r) => r.name);
}

export async function getAllWithIds(): Promise<Category[]> {
  const db = await getDB();
  return db.getAllAsync<Category>(
    "SELECT id, name FROM categories ORDER BY sort_order ASC"
  );
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

export async function renameCategory(id: string, newName: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET name = ? WHERE id = ?", [newName, id]);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
}

export async function updateOrder(ids: string[]): Promise<void> {
  const db = await getDB();
  await db.execAsync("BEGIN");
  try {
    for (let i = 0; i < ids.length; i++) {
      await db.runAsync("UPDATE categories SET sort_order = ? WHERE id = ?", [i, ids[i]]);
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
