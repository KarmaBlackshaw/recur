import { getDB } from "./schema";

export async function getAll(): Promise<string[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM categories ORDER BY name ASC"
  );
  return rows.map((r) => r.name);
}

export async function insertCategory(name: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("INSERT OR IGNORE INTO categories (name) VALUES (?)", [name]);
}

export async function deleteCategory(name: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM categories WHERE name = ?", [name]);
}
