import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("recur.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      amount      REAL NOT NULL,
      dueDay      INTEGER NOT NULL DEFAULT 1,
      recurrence  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'unpaid',
      notes       TEXT,
      createdAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY NOT NULL
    );
  `);

  // Migration: if old dueDate column exists, backfill dueDay and remove column usage
  const cols = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(expenses)"
  );
  const hasDueDate = cols.some((c) => c.name === "dueDate");
  const hasDueDay = cols.some((c) => c.name === "dueDay");

  if (hasDueDate && !hasDueDay) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN dueDay INTEGER NOT NULL DEFAULT 1;`);
    await db.execAsync(
      `UPDATE expenses SET dueDay = CAST(strftime('%d', dueDate) AS INTEGER) WHERE dueDate IS NOT NULL;`
    );
  }

  return db;
}
