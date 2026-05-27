import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("recur.db");
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`
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
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      name       TEXT PRIMARY KEY NOT NULL
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prefs (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Migration: add id + sort_order to categories if missing
  const catCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(categories)");
  const hasId = catCols.some((c) => c.name === "id");
  if (!hasId) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN id TEXT NOT NULL DEFAULT ''`);
    const rows = await db.getAllAsync<{ name: string }>("SELECT name FROM categories");
    for (const row of rows) {
      const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await db.runAsync("UPDATE categories SET id = ? WHERE name = ?", [uuid, row.name]);
    }
  }
  const hasSortOrder = catCols.some((c) => c.name === "sort_order");
  if (!hasSortOrder) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    // Backfill preset order for existing rows
    const existing = await db.getAllAsync<{ name: string }>("SELECT name FROM categories ORDER BY name ASC");
    for (let i = 0; i < existing.length; i++) {
      await db.runAsync("UPDATE categories SET sort_order = ? WHERE name = ?", [i, existing[i].name]);
    }
  }

  // Seed presets — id uses the name slug as a stable value for presets
  await db.execAsync(`
    INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
      ('preset-housing','Housing',0),('preset-utilities','Utilities',1),
      ('preset-insurance','Insurance',2),('preset-subscriptions','Subscriptions',3),
      ('preset-transport','Transport',4),('preset-food','Food',5),
      ('preset-health','Health',6),('preset-entertainment','Entertainment',7),
      ('preset-education','Education',8),('preset-savings','Savings',9),
      ('preset-debt','Debt',10),('preset-other','Other',11);
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
    await db.execAsync(`BEGIN;`);
    await db.execAsync(`ALTER TABLE expenses RENAME TO expenses_old;`);
    await db.execAsync(`
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
    `);
    await db.execAsync(`
      INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, notes, createdAt)
        SELECT id, name, category, amount, ${dueDaySrc}, recurrence, status, notes, createdAt
        FROM expenses_old;
    `);
    await db.execAsync(`DROP TABLE expenses_old;`);
    await db.execAsync(`COMMIT;`);
  }

  return db;
}
