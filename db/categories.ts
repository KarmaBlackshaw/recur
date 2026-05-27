import { getDB } from "./schema";

export async function getAll(): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM categories ORDER BY sort_order ASC"
  );
  return rows.map((r) => r.name);
}

export async function insertCategory(name: string): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ max_order: number }>(
    "SELECT MAX(sort_order) as max_order FROM categories"
  );
  const nextOrder = (row?.max_order ?? -1) + 1;
  await db.runAsync(
    "INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)",
    [name, nextOrder]
  );
}

export async function renameCategory(oldName: string, newName: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE categories SET name = ? WHERE name = ?", [newName, oldName]);
}

export async function deleteCategory(name: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM categories WHERE name = ?", [name]);
}

export async function updateOrder(names: string[]): Promise<void> {
  const db = await getDB();
  await db.execAsync("BEGIN");
  try {
    for (let i = 0; i < names.length; i++) {
      await db.runAsync("UPDATE categories SET sort_order = ? WHERE name = ?", [i, names[i]]);
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
