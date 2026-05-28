import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return Promise.resolve(db);
  if (initPromise) return initPromise;
  initPromise = _init();
  return initPromise;
}

async function _init(): Promise<SQLite.SQLiteDatabase> {
  db = await SQLite.openDatabaseAsync("recur.db");
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      amount      REAL,
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
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expense_months (
      expense_id  TEXT NOT NULL,
      year        INTEGER NOT NULL,
      month       INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'unpaid',
      PRIMARY KEY (expense_id, year, month),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );
  `);

  // Migration: allow NULL amount (TBD expenses)
  const amountNullMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_amount_nullable_v1'"
  );
  if (!amountNullMigrated) {
    const expCols = await db.getAllAsync<{ name: string; notnull: number }>("PRAGMA table_info(expenses)");
    const amountCol = expCols.find((c) => c.name === "amount");
    if (amountCol && amountCol.notnull === 1) {
      await db.execAsync(`BEGIN;`);
      await db.execAsync(`ALTER TABLE expenses RENAME TO expenses_old;`);
      await db.execAsync(`
        CREATE TABLE expenses (
          id          TEXT PRIMARY KEY NOT NULL,
          name        TEXT NOT NULL,
          category    TEXT NOT NULL,
          amount      REAL,
          dueDay      INTEGER NOT NULL DEFAULT 1,
          recurrence  TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'unpaid',
          notes       TEXT,
          createdAt   TEXT NOT NULL
        );
      `);
      await db.execAsync(`
        INSERT INTO expenses (id, name, category, amount, dueDay, recurrence, status, notes, createdAt)
          SELECT id, name, category, amount, dueDay, recurrence, status, notes, createdAt
          FROM expenses_old;
      `);
      await db.execAsync(`DROP TABLE expenses_old;`);
      await db.execAsync(`COMMIT;`);
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_amount_nullable_v1', '1')"
    );
  }

  // One-time migration: seed expense_months for currently-paid recurring expenses
  const migrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_expense_months_v1'"
  );
  if (!migrated) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-based
    await db.runAsync(
      `INSERT OR IGNORE INTO expense_months (expense_id, year, month, status)
       SELECT id, ?, ?, status FROM expenses WHERE status = 'paid' AND recurrence != 'one-off'`,
      [year, month]
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expense_months_v1', '1')"
    );
  }

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

  // Migration: add icon column to categories if missing
  const catColsForIcon = await db.getAllAsync<{ name: string }>("PRAGMA table_info(categories)");
  const hasIcon = catColsForIcon.some((c) => c.name === "icon");
  if (!hasIcon) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'more-horizontal'`);
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

  // Backfill preset icons (one-time)
  const presetIconsMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_preset_icons_v1'"
  );
  if (!presetIconsMigrated) {
    await db.execAsync(`UPDATE categories SET icon = 'home'            WHERE id = 'preset-housing'`);
    await db.execAsync(`UPDATE categories SET icon = 'zap'             WHERE id = 'preset-utilities'`);
    await db.execAsync(`UPDATE categories SET icon = 'shield'          WHERE id = 'preset-insurance'`);
    await db.execAsync(`UPDATE categories SET icon = 'grid'            WHERE id = 'preset-subscriptions'`);
    await db.execAsync(`UPDATE categories SET icon = 'truck'           WHERE id = 'preset-transport'`);
    await db.execAsync(`UPDATE categories SET icon = 'coffee'          WHERE id = 'preset-food'`);
    await db.execAsync(`UPDATE categories SET icon = 'heart'           WHERE id = 'preset-health'`);
    await db.execAsync(`UPDATE categories SET icon = 'music'           WHERE id = 'preset-entertainment'`);
    await db.execAsync(`UPDATE categories SET icon = 'book'            WHERE id = 'preset-education'`);
    await db.execAsync(`UPDATE categories SET icon = 'dollar-sign'     WHERE id = 'preset-savings'`);
    await db.execAsync(`UPDATE categories SET icon = 'credit-card'     WHERE id = 'preset-debt'`);
    await db.execAsync(`UPDATE categories SET icon = 'more-horizontal' WHERE id = 'preset-other'`);
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_preset_icons_v1', '1')"
    );
  }

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
        amount      REAL,
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
