import type { SQLiteDatabase } from "expo-sqlite";

export type MigrationDb = Pick<SQLiteDatabase, "getAllAsync" | "execAsync">;

// The cash-flow forecast's account settings. Existing accounts keep NULL: no account pays their card bill, and they
// use the general low-balance threshold.
export async function addForecastColumns(db: MigrationDb): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(accounts)");
  if (!cols.some((c) => c.name === "pay_bill_from_account_id")) {
    await db.execAsync("ALTER TABLE accounts ADD COLUMN pay_bill_from_account_id TEXT");
  }
  if (!cols.some((c) => c.name === "low_balance_threshold")) {
    await db.execAsync("ALTER TABLE accounts ADD COLUMN low_balance_threshold REAL");
  }
}
