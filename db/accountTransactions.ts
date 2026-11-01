import dayjs from "dayjs";
import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import type { AccountTransaction, IncomeInput, TransactionKind } from "@/types";

interface TransactionRow {
  id: string; account_id: string; kind: string; amount: number;
  expense_id: string | null; cycle_year: number | null; cycle_month: number | null;
  transfer_id: string | null; note: string | null; category: string | null; loan_id: string | null; created_at: string;
}

const COLUMNS =
  "id, account_id, kind, amount, expense_id, cycle_year, cycle_month, transfer_id, note, category, loan_id, created_at";

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
  return { expenseId: null, cycleYear: null, cycleMonth: null, transferId: null, note: null, category: null, loanId: null };
}

export async function insertRow(
  db: Awaited<ReturnType<typeof getDB>>,
  t: Omit<AccountTransaction, "id">
): Promise<AccountTransaction> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO account_transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, t.accountId, t.kind, t.amount, t.expenseId, t.cycleYear, t.cycleMonth, t.transferId, t.note, t.category, t.loanId, t.createdAt]
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

export async function replacePayment(
  expenseId: string,
  cycleYear: number | null,
  cycleMonth: number | null,
  t: Omit<AccountTransaction, "id"> | null
): Promise<AccountTransaction | null> {
  const db = await getDB();
  let inserted: AccountTransaction | null = null;
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(
      `DELETE FROM account_transactions
       WHERE kind = 'payment' AND expense_id = ?
         AND IFNULL(cycle_year, -1) = IFNULL(?, -1) AND IFNULL(cycle_month, -1) = IFNULL(?, -1)`,
      [expenseId, cycleYear, cycleMonth]
    );
    if (t) {
      inserted = await insertRow(txn, t);
    }
  });
  return inserted;
}

// Rewrites every row of a transfer (both sides, fee, income) in one write, keeping its transfer id.
export async function replaceTransfer(
  transferId: string,
  ts: Omit<AccountTransaction, "id">[]
): Promise<AccountTransaction[]> {
  const db = await getDB();
  const inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync("DELETE FROM account_transactions WHERE transfer_id = ?", [transferId]);
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
    "UPDATE account_transactions SET account_id = ?, amount = ?, category = ?, note = ?, created_at = ? WHERE id = ? AND kind = 'income'",
    [input.accountId, input.amount, input.category, input.note, input.receivedAt, id]
  );
}

export async function updateLoanPayment(
  id: string,
  p: { accountId: string; amount: number; paidAt: string }
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "UPDATE account_transactions SET account_id = ?, amount = ?, created_at = ? WHERE id = ? AND kind = 'loan_in'",
    [p.accountId, p.amount, p.paidAt, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM account_transactions WHERE id = ?", [id]);
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
    `INSERT OR IGNORE INTO account_transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.accountId, t.kind, t.amount, t.expenseId, t.cycleYear, t.cycleMonth, t.transferId, t.note, t.category ?? null, t.loanId ?? null, t.createdAt]
  );
  return result.changes;
}
