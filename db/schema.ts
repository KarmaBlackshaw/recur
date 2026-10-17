import * as SQLite from "expo-sqlite";
import dayjs from "dayjs";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return Promise.resolve(db);
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = openDatabase();
  return initPromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  db = await SQLite.openDatabaseAsync("recur.db");
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync("PRAGMA busy_timeout = 5000;");

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

  // Enforce one row per category name. Older installs never had this enforced, so the
  // INSERT OR IGNORE preset seed below re-added presets every launch and they accumulated
  // (e.g. two 'Utilities' rows) → duplicate keys in the category list. Dedup once (keep the
  // lowest rowid per name), then add a UNIQUE index so the seed/inserts can't dup again.
  // Must run BEFORE the seed so its OR IGNORE has the index to conflict on.
  await db.runAsync(
    "DELETE FROM categories WHERE rowid NOT IN (SELECT MIN(rowid) FROM categories GROUP BY name)"
  );
  await db.execAsync("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name)");

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

  // Migration: add paid_at to expense_months (when a recurring month was marked paid)
  const monthPaidAtMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_expense_months_paid_at_v1'"
  );
  if (!monthPaidAtMigrated) {
    await db.execAsync(`ALTER TABLE expense_months ADD COLUMN paid_at TEXT`);
    // Existing paid months have no recorded timestamp; leave NULL — the UI falls back to the month's due date.
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_expense_months_paid_at_v1', '1')"
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

  // Migration: add last_used_at to categories (recency-based picker sort).
  // NULL = never used; backfilled from existing expense history (most recent use per category).
  const catLastUsedMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_category_last_used_v1'"
  );
  if (!catLastUsedMigrated) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN last_used_at TEXT`);
    await db.runAsync(
      `UPDATE categories SET last_used_at = (
         SELECT MAX(createdAt) FROM expenses WHERE expenses.category = categories.name
       )`
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_category_last_used_v1', '1')"
    );
  }

  const accountsMigrated = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = 'migrated_accounts_v2'"
  );
  if (!accountsMigrated) {
    const oldCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(accounts)");
    if (oldCols.length > 0 && !oldCols.some((c) => c.name === "interest_rate")) {
      await db.execAsync("ALTER TABLE accounts RENAME TO accounts_v1");
    }
  }
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id                TEXT PRIMARY KEY NOT NULL,
      name              TEXT NOT NULL,
      type              TEXT NOT NULL,
      sort_order        INTEGER NOT NULL DEFAULT 0,
      interest_rate     REAL,
      interest_period   TEXT,
      tax_rate          REAL,
      interest_accrued_through TEXT,
      credit_limit      REAL,
      statement_day     INTEGER,
      due_day           INTEGER,
      created_at        TEXT NOT NULL
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS account_transactions (
      id           TEXT PRIMARY KEY NOT NULL,
      account_id   TEXT NOT NULL,
      kind         TEXT NOT NULL,
      amount       REAL NOT NULL,
      expense_id   TEXT,
      cycle_year   INTEGER,
      cycle_month  INTEGER,
      transfer_id  TEXT,
      note         TEXT,
      created_at   TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
  `);
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_txn_account ON account_transactions(account_id)"
  );
  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_payment
     ON account_transactions(expense_id, IFNULL(cycle_year, -1), IFNULL(cycle_month, -1)) WHERE kind = 'payment'`
  );
  if (!accountsMigrated) {
    const v1Table = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts_v1'"
    );
    if (v1Table) {
      await db.runAsync(
        `INSERT OR IGNORE INTO accounts (id, name, type, sort_order, credit_limit, statement_day, due_day, created_at, interest_accrued_through)
         SELECT id, name, CASE type WHEN 'bank' THEN 'debit' ELSE type END, sort_order, credit_limit, bill_day, due_day, created_at,
                CASE type WHEN 'bank' THEN ? ELSE NULL END
         FROM accounts_v1`,
        [dayjs().format("YYYY-MM-DD")]
      );
      await db.execAsync("DROP TABLE accounts_v1");
    }
    await db.execAsync("DROP TABLE IF EXISTS account_statements");
    const expenseCols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(expenses)");
    if (!expenseCols.some((c) => c.name === "account_id")) {
      await db.execAsync("ALTER TABLE expenses ADD COLUMN account_id TEXT");
    }
    if (v1Table) {
      await db.runAsync("UPDATE expenses SET account_id = NULL WHERE account_id = 'account-cash-default'");
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO prefs (key, value) VALUES ('migrated_accounts_v2', '1')"
    );
  }

  return db;
}
