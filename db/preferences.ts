import { getDB } from "./schema";

export async function getPreference(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function deletePreference(key: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM prefs WHERE key = ?", [key]);
}
