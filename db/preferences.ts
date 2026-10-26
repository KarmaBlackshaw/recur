import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";

// Pass a transaction as `db` to read or write inside it.
export async function getPreference(key: string, db?: SQLiteDatabase): Promise<string | null> {
  const conn = db ?? (await getDB());
  const row = await conn.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = ?",
    [key]
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string, db?: SQLiteDatabase): Promise<void> {
  const conn = db ?? (await getDB());
  await conn.runAsync(
    "INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function deletePreference(key: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM prefs WHERE key = ?", [key]);
}
