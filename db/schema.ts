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

  // Legacy: amount is already nullable in the canonical CREATE TABLE above.
  const amountNullMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_amount_nullable_v1'"
  );
  if (!amountNullMigrated) {
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

  // Legacy: dueDate column was removed. All queries in db/expenses.ts enumerate columns explicitly so a residual column is inert.
  const dueDateMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_remove_duedate_v1'"
  );
  if (!dueDateMigrated) {
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_remove_duedate_v1', '1')"
    );
  }

  // Migration: add is_variable to expenses
  const isVariableMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_expenses_is_variable_v1'"
  );
  if (!isVariableMigrated) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN is_variable INTEGER NOT NULL DEFAULT 0`);
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expenses_is_variable_v1', '1')"
    );
  }

  // Migration: add amount to expense_months
  const monthAmountMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_expense_months_amount_v1'"
  );
  if (!monthAmountMigrated) {
    await db.execAsync(`ALTER TABLE expense_months ADD COLUMN amount REAL`);
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expense_months_amount_v1', '1')"
    );
  }

  // Migration: add reminder_days_before to expenses
  const reminderDaysMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_reminder_days_before_v1'"
  );
  if (!reminderDaysMigrated) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN reminder_days_before INTEGER DEFAULT NULL`);
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_reminder_days_before_v1', '1')"
    );
  }

  // Migration: add paid_date to expenses (when a one-off was paid)
  const paidDateMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_paid_date_v1'"
  );
  if (!paidDateMigrated) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN paid_date TEXT`);
    // Backfill existing paid one-offs so they have a sensible paid date (use createdAt).
    await db.runAsync(
      `UPDATE expenses SET paid_date = createdAt WHERE recurrence = 'one-off' AND status = 'paid' AND paid_date IS NULL`
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_paid_date_v1', '1')"
    );
  }

  // Migration: add end_year / end_month to expenses (recurring end month)
  const endMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_expense_end_v1'"
  );
  if (!endMigrated) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN end_year INTEGER`);
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN end_month INTEGER`);
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expense_end_v1', '1')"
    );
  }

  return db;
}
