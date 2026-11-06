import dayjs from "dayjs";
import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import type { AccountTransaction, IncomeInput, TransactionKind } from "@/types";

interface TransactionRow {
  id: string; account_id: string; kind: string; amount: number;
  expense_id: string | null; cycle_year: number | null; cycle_month: number | null;
  transfer_id: string | null; note: string | null; category: string | null; loan_id: string | null; created_at: string;
  reverses_id: string | null;
}

const COLUMNS =
  "id, account_id, kind, amount, expense_id, cycle_year, cycle_month, transfer_id, note, category, loan_id, created_at, reverses_id";

export const LIVE_SQL = "kind != 'reversal' AND NOT EXISTS (SELECT 1 FROM account_transactions r WHERE r.reverses_id = account_transactions.id)";

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toTransaction(r: TransactionRow): AccountTransaction {
  return {
    id: r.id,
    accountId: r.account_id,
    kind: r.kind as TransactionKind,
    amount: r.amount,
    expenseId: r.expense_id,
    cycleYear: r.cycle_year,
    cycleMonth: r.cycle_month,
    transferId: r.transfer_id,
    note: r.note,
    category: r.category,
    loanId: r.loan_id,
    createdAt: r.created_at,
    reversesId: r.reverses_id,
  };
}

export async function getAll(): Promise<AccountTransaction[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT ${COLUMNS} FROM account_transactions ORDER BY created_at ASC`
  );
  return rows.map(toTransaction);
}

export function emptyTxnFields(): Omit<AccountTransaction, "id" | "accountId" | "kind" | "amount" | "createdAt"> {
  return { expenseId: null, cycleYear: null, cycleMonth: null, transferId: null, note: null, category: null, loanId: null, reversesId: null };
}

export async function insertRow(
  db: Awaited<ReturnType<typeof getDB>>,
  t: Omit<AccountTransaction, "id">
): Promise<AccountTransaction> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO account_transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, t.accountId, t.kind, t.amount, t.expenseId, t.cycleYear, t.cycleMonth, t.transferId, t.note, t.category, t.loanId, t.createdAt, t.reversesId]
  );
  return { ...t, id };
}

export async function insert(t: Omit<AccountTransaction, "id">): Promise<AccountTransaction> {
  const db = await getDB();
  return insertRow(db, t);
}

export async function insertMany(ts: Omit<AccountTransaction, "id">[]): Promise<AccountTransaction[]> {
  const db = await getDB();
  const inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    for (const t of ts) {
      inserted.push(await insertRow(txn, t));
    }
  });
  return inserted;
}

export async function replacePayments(
  expenseId: string,
  cycleYear: number | null,
  cycleMonth: number | null,
  ts: Omit<AccountTransaction, "id">[]
): Promise<AccountTransaction[]> {
  const db = await getDB();
  const inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(
      `DELETE FROM account_transactions
       WHERE kind = 'payment' AND expense_id = ? AND ${LIVE_SQL}
         AND IFNULL(cycle_year, -1) = IFNULL(?, -1) AND IFNULL(cycle_month, -1) = IFNULL(?, -1)`,
      [expenseId, cycleYear, cycleMonth]
    );
    for (const t of ts) {
      inserted.push(await insertRow(txn, t));
    }
  });
  return inserted;
}

export function paymentMonthKey(expenseId: string | null, cycleYear: number | null, cycleMonth: number | null): string {
  return `${expenseId}|${cycleYear ?? -1}|${cycleMonth ?? -1}`;
}

export async function getPaymentMonthKeys(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ expense_id: string; cycle_year: number; cycle_month: number }>(
    `SELECT DISTINCT expense_id, IFNULL(cycle_year, -1) AS cycle_year, IFNULL(cycle_month, -1) AS cycle_month
     FROM account_transactions WHERE kind = 'payment' AND ${LIVE_SQL}`
  );
  return new Set(rows.map((r) => paymentMonthKey(r.expense_id, r.cycle_year, r.cycle_month)));
}

// Rewrites every row of a transfer (both sides, fee, income) in one write, keeping its transfer id.
export async function replaceTransfer(
  transferId: string,
  ts: Omit<AccountTransaction, "id">[]
): Promise<AccountTransaction[]> {
  const db = await getDB();
  const inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(`DELETE FROM account_transactions WHERE transfer_id = ? AND ${LIVE_SQL}`, [transferId]);
    for (const t of ts) {
      inserted.push(await insertRow(txn, t));
    }
  });
  return inserted;
}

export async function removeTransfer(transferId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM account_transactions WHERE transfer_id = ?", [transferId]);
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE account_transactions SET account_id = ?, amount = ?, category = ?, note = ?, created_at = ? WHERE id = ? AND kind = 'income' AND ${LIVE_SQL}`,
    [input.accountId, input.amount, input.category, input.note, input.receivedAt, id]
  );
}

export async function updateLoanPayment(
  id: string,
  p: { accountId: string; amount: number; paidAt: string }
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE account_transactions SET account_id = ?, amount = ?, created_at = ? WHERE id = ? AND kind = 'loan_in' AND ${LIVE_SQL}`,
    [p.accountId, p.amount, p.paidAt, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM account_transactions WHERE id = ? OR reverses_id = ?", [id, id]);
}

export async function creditInterest(accountId: string, gross: number, tax: number, through: string): Promise<void> {
  const db = await getDB();
  const createdAt = dayjs(through).endOf("day").toISOString();
  await withWriteTransaction(db, async (txn) => {
    if (gross !== 0) {
      await insertRow(txn, { ...emptyTxnFields(), accountId, kind: "interest", amount: gross, createdAt });
      if (tax !== 0) {
        await insertRow(txn, { ...emptyTxnFields(), accountId, kind: "tax", amount: -tax, createdAt });
      }
    }
    await txn.runAsync("UPDATE accounts SET interest_accrued_through = ? WHERE id = ?", [through, accountId]);
  });
}

// Restores a transaction from a backup. Pass the import's transaction as `db`; returns 1 when added, 0 when it
// already existed.
export async function insertWithId(t: AccountTransaction, db?: SQLiteDatabase): Promise<number> {
  const conn = db ?? (await getDB());
  const result = await conn.runAsync(
    `INSERT OR IGNORE INTO account_transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.accountId, t.kind, t.amount, t.expenseId, t.cycleYear, t.cycleMonth, t.transferId, t.note, t.category ?? null, t.loanId ?? null, t.createdAt, t.reversesId]
  );
  return result.changes;
}

async function isLive(txn: SQLiteDatabase, id: string): Promise<boolean> {
  const row = await txn.getFirstAsync<{ id: string }>(
    `SELECT id FROM account_transactions WHERE id = ? AND ${LIVE_SQL}`,
    [id]
  );
  return row !== null;
}

export async function insertReversalRows(txn: SQLiteDatabase, rows: Omit<AccountTransaction, "id">[]): Promise<AccountTransaction[]> {
  const inserted: AccountTransaction[] = [];
  for (const row of rows) {
    if (row.kind !== "reversal" || row.reversesId === null) {
      throw new Error("A reversal row needs kind 'reversal' and a reversed id");
    }
    const isOriginalLive = await isLive(txn, row.reversesId);
    if (!isOriginalLive) {
      throw new Error("Already reverted");
    }
    inserted.push(await insertRow(txn, row));
  }
  return inserted;
}

export async function insertReversals(rows: Omit<AccountTransaction, "id">[]): Promise<AccountTransaction[]> {
  const db = await getDB();
  let inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    inserted = await insertReversalRows(txn, rows);
  });
  return inserted;
}

export async function removeReversals(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = await getDB();
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(`DELETE FROM account_transactions WHERE kind = 'reversal' AND id IN (${placeholders})`, ids);
}

export async function removePayments(expenseId: string, cycleYear: number | null, cycleMonth: number | null): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `DELETE FROM account_transactions
     WHERE kind IN ('payment', 'reversal') AND expense_id = ?
       AND IFNULL(cycle_year, -1) = IFNULL(?, -1) AND IFNULL(cycle_month, -1) = IFNULL(?, -1)`,
    [expenseId, cycleYear, cycleMonth]
  );
}
