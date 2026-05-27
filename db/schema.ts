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
      name       TEXT PRIMARY KEY NOT NULL
    );
  `);

  // Migration: add sort_order to categories if missing
  const catCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(categories)");
  const hasSortOrder = catCols.some((c) => c.name === "sort_order");
  if (!hasSortOrder) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    // Backfill preset order for existing rows
    const existing = await db.getAllAsync<{ name: string }>("SELECT name FROM categories ORDER BY name ASC");
    for (let i = 0; i < existing.length; i++) {
      await db.runAsync("UPDATE categories SET sort_order = ? WHERE name = ?", [i, existing[i].name]);
    }
  }

  // Seed presets after sort_order column is guaranteed to exist
  await db.execAsync(`
    INSERT OR IGNORE INTO categories (name, sort_order) VALUES
      ('Housing',0),('Utilities',1),('Insurance',2),('Subscriptions',3),
      ('Transport',4),('Food',5),('Health',6),('Entertainment',7),
      ('Education',8),('Savings',9),('Debt',10),('Other',11);
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
