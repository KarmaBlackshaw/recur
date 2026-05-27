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

    INSERT OR IGNORE INTO categories (name) VALUES
      ('Housing'),('Utilities'),('Insurance'),('Subscriptions'),
      ('Transport'),('Food'),('Health'),('Entertainment'),
      ('Education'),('Savings'),('Debt'),('Other');
  `);

  // Migration: rebuild table without dueDate column if it still exists
  const cols = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(expenses)"
  );
  const hasDueDate = cols.some((c) => c.name === "dueDate");

  if (hasDueDate) {
    const hasDueDay = cols.some((c) => c.name === "dueDay");
    const dueDaySrc = hasDueDay
      ? "dueDay"
      : "COALESCE(CAST(strftime('%d', dueDate) AS INTEGER), 1)";
    await db.execAsync(`
      BEGIN;
      ALTER TABLE expenses RENAME TO expenses_old;
      CREATE TABLE expenses (
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
      INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, notes, createdAt)
        SELECT id, name, category, amount, ${dueDaySrc}, recurrence, status, notes, createdAt
        FROM expenses_old;
      DROP TABLE expenses_old;
      COMMIT;
    `);
  }

  return db;
}
