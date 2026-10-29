import dayjs from "dayjs";
import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import type { BankId } from "@/constants/banks";
import { isIoniconName } from "@/constants/ionicons";
import type { Account, AccountInput, AccountType, InterestPeriod } from "@/types";

interface AccountRow {
  id: string; name: string; type: string; sort_order: number;
  interest_rate: number | null; interest_period: string | null; tax_rate: number | null;
  interest_accrued_through: string | null; credit_limit: number | null;
  statement_day: number | null; due_day: number | null; created_at: string;
  color: string | null; icon: string | null; logo_uri: string | null; bank: string | null;
  archived_at: string | null;
}

const COLUMNS =
  "id, name, type, sort_order, interest_rate, interest_period, tax_rate, interest_accrued_through, credit_limit, statement_day, due_day, created_at, color, icon, logo_uri, bank, archived_at";

function toAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    type: r.type as AccountType,
    sortOrder: r.sort_order,
    interestRate: r.interest_rate,
    interestPeriod: r.interest_period as InterestPeriod | null,
    taxRate: r.tax_rate,
    interestAccruedThrough: r.interest_accrued_through,
    creditLimit: r.credit_limit,
    statementDay: r.statement_day,
    dueDay: r.due_day,
    createdAt: r.created_at,
    color: r.color,
    icon: isIoniconName(r.icon) ? r.icon : null,
    logoUri: r.logo_uri,
    bank: r.bank as BankId | null,
    archivedAt: r.archived_at,
  };
}

export async function getAll(): Promise<Account[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT ${COLUMNS} FROM accounts ORDER BY sort_order ASC, created_at ASC`
  );
  return rows.map(toAccount);
}

export async function insert(input: AccountInput): Promise<Account> {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createdAt = new Date().toISOString();
  const row = await db.getFirstAsync<{ max_order: number | null }>(
    "SELECT MAX(sort_order) AS max_order FROM accounts"
  );
  const sortOrder = (row?.max_order ?? -1) + 1;
  const interestAccruedThrough = input.type === "debit" ? dayjs().format("YYYY-MM-DD") : null;
  await db.runAsync(
    `INSERT INTO accounts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.type, sortOrder, input.interestRate, input.interestPeriod, input.taxRate, interestAccruedThrough, input.creditLimit, input.statementDay, input.dueDay, createdAt, input.color, input.icon, input.logoUri, input.bank, null]
  );
  return { ...input, id, sortOrder, interestAccruedThrough, archivedAt: null, createdAt };
}

export async function getById(id: string): Promise<Account | undefined> {
  const db = await getDB();
  const row = await db.getFirstAsync<AccountRow>(`SELECT ${COLUMNS} FROM accounts WHERE id = ?`, [id]);
  return row ? toAccount(row) : undefined;
}

export async function update(id: string, input: AccountInput): Promise<void> {
  const db = await getDB();
  const today = dayjs().format("YYYY-MM-DD");
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(
      `UPDATE accounts SET name=?, type=?, interest_rate=?, interest_period=?, tax_rate=?, credit_limit=?, statement_day=?, due_day=?, color=?, icon=?, logo_uri=?, bank=?,
       interest_accrued_through = CASE
         WHEN ? != 'debit' THEN interest_accrued_through
         WHEN IFNULL(interest_rate, 0) <= 0 AND IFNULL(?, 0) > 0 THEN ?
         ELSE COALESCE(interest_accrued_through, ?)
       END
       WHERE id=?`,
      [input.name, input.type, input.interestRate, input.interestPeriod, input.taxRate, input.creditLimit, input.statementDay, input.dueDay, input.color, input.icon, input.logoUri, input.bank, input.type, input.interestRate, today, today, id]
    );
    // Recurring expenses charged to a card are due with its bill, so they follow its due day.
    if (input.type === "credit" && input.dueDay != null) {
      await txn.runAsync("UPDATE expenses SET dueDay = ? WHERE account_id = ? AND recurrence != 'one-off'", [input.dueDay, id]);
    }
  });
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ name: string }>("SELECT name FROM accounts WHERE id = ?", [id]);
  const note = `Transfer with ${row?.name ?? ""}`;
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync("UPDATE expenses SET account_id = NULL WHERE account_id = ?", [id]);
    await txn.runAsync(
      `UPDATE account_transactions SET note = ?
       WHERE kind = 'transfer' AND account_id != ?
         AND transfer_id IN (SELECT transfer_id FROM account_transactions WHERE account_id = ? AND kind = 'transfer')`,
      [note, id, id]
    );
    await txn.runAsync("DELETE FROM card_bills WHERE account_id = ?", [id]);
    await txn.runAsync("DELETE FROM account_transactions WHERE account_id = ?", [id]);
    await txn.runAsync("DELETE FROM accounts WHERE id = ?", [id]);
  });
}

// Archived accounts earn nothing, so interest picks up again from the day an account is unarchived.
export async function setArchivedAt(id: string, archivedAt: string | null): Promise<void> {
  const db = await getDB();
  const today = dayjs().format("YYYY-MM-DD");
  await db.runAsync(
    `UPDATE accounts SET archived_at = ?,
       interest_accrued_through = CASE
         WHEN ? IS NULL AND interest_accrued_through IS NOT NULL AND interest_accrued_through < ? THEN ?
         ELSE interest_accrued_through
       END
     WHERE id = ?`,
    [archivedAt, archivedAt, today, today, id]
  );
}

// Restores an account from a backup. Pass the import's transaction as `db`; returns 1 when added, 0 when it
// already existed.
export async function insertWithId(a: Account, db?: SQLiteDatabase): Promise<number> {
  const conn = db ?? (await getDB());
  const result = await conn.runAsync(
    `INSERT OR IGNORE INTO accounts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.name, a.type, a.sortOrder, a.interestRate, a.interestPeriod, a.taxRate, a.interestAccruedThrough, a.creditLimit, a.statementDay, a.dueDay, a.createdAt, a.color ?? null, a.icon ?? null, a.logoUri ?? null, a.bank ?? null, a.archivedAt ?? null]
  );
  return result.changes;
}
