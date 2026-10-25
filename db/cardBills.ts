import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import type { CardBillOverride } from "@/types";

export async function getAll(): Promise<CardBillOverride[]> {
  const db = await getDB();
  return db.getAllAsync<CardBillOverride>(
    "SELECT account_id AS accountId, year, month, amount FROM card_bills"
  );
}

export async function setAmount(accountId: string, year: number, month: number, amount: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO card_bills (account_id, year, month, amount) VALUES (?, ?, ?, ?)",
    [accountId, year, month, amount]
  );
}

export async function clearAmount(accountId: string, year: number, month: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM card_bills WHERE account_id = ? AND year = ? AND month = ?", [accountId, year, month]);
}

// Restores a bill amount from a backup. Pass the import's transaction as `db`; returns 1 when added, 0 when it
// already existed.
export async function insertOrIgnore(o: CardBillOverride, db?: SQLiteDatabase): Promise<number> {
  const conn = db ?? (await getDB());
  const result = await conn.runAsync(
    "INSERT OR IGNORE INTO card_bills (account_id, year, month, amount) VALUES (?, ?, ?, ?)",
    [o.accountId, o.year, o.month, o.amount]
  );
  return result.changes;
}
