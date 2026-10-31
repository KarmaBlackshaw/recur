import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { insertRow, newId } from "@/db/accountTransactions";
import { touchCategory } from "@/db/categories";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import { fromLoanInterest } from "@/utils/loans/fromLoanInterest";
import { toLoanInterest } from "@/utils/loans/toLoanInterest";
import { uniq } from "@/utils/collections";
import type { Loan, LoanExcessInput, LoanInput, LoanPaymentInput, TLoanInterestType } from "@/types";

interface LoanRow {
  id: string; borrower: string; principal: number; account_id: string; lent_at: string;
  interest_type: string; interest_value: number | null; note: string | null; created_at: string;
}

const COLUMNS =
  "id, borrower, principal, account_id, lent_at, interest_type, interest_value, note, created_at";

function toLoan(r: LoanRow): Loan {
  return {
    id: r.id,
    borrower: r.borrower,
    principal: r.principal,
    accountId: r.account_id,
    lentAt: r.lent_at,
    interest: toLoanInterest(r.interest_type as TLoanInterestType, r.interest_value),
    note: r.note,
    createdAt: r.created_at,
  };
}

type TWriteDb = Awaited<ReturnType<typeof getDB>>;

// FKs are off inside write transactions, so probe the account explicitly
async function hasAccount(txn: TWriteDb, accountId: string) {
  const account = await txn.getFirstAsync<{ id: string }>("SELECT id FROM accounts WHERE id = ?", [accountId]);
  return account !== null;
}

async function writeLoanOut(txn: TWriteDb, loan: Pick<Loan, "id" | "accountId" | "principal" | "lentAt">): Promise<void> {
  const hasLoanAccount = await hasAccount(txn, loan.accountId);
  if (!hasLoanAccount) {
    return;
  }
  await insertRow(txn, {
    accountId: loan.accountId, kind: "loan_out", amount: -loan.principal, expenseId: null, cycleYear: null,
    cycleMonth: null, transferId: null, note: null, category: null, loanId: loan.id, createdAt: loan.lentAt,
  });
}

export async function getAll(): Promise<Loan[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<LoanRow>(`SELECT ${COLUMNS} FROM loans ORDER BY lent_at DESC`);
  return rows.map(toLoan);
}

export async function insert(input: LoanInput): Promise<Loan> {
  const db = await getDB();
  const loan: Loan = { ...input, id: newId(), createdAt: new Date().toISOString() };
  const { type: interestType, value: interestValue } = fromLoanInterest(loan.interest);
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(
      `INSERT INTO loans (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [loan.id, loan.borrower, loan.principal, loan.accountId, loan.lentAt, interestType, interestValue, loan.note, loan.createdAt]
    );
    await writeLoanOut(txn, loan);
  });
  return loan;
}

export async function update(id: string, input: LoanInput): Promise<void> {
  const db = await getDB();
  const { type: interestType, value: interestValue } = fromLoanInterest(input.interest);
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync(
      "UPDATE loans SET borrower = ?, principal = ?, account_id = ?, lent_at = ?, interest_type = ?, interest_value = ?, note = ? WHERE id = ?",
      [input.borrower, input.principal, input.accountId, input.lentAt, interestType, interestValue, input.note, id]
    );
    await txn.runAsync("DELETE FROM account_transactions WHERE loan_id = ? AND kind = 'loan_out'", [id]);
    await writeLoanOut(txn, { ...input, id });
  });
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await withWriteTransaction(db, async (txn) => {
    await txn.runAsync("DELETE FROM account_transactions WHERE loan_id = ?", [id]);
    await txn.runAsync("DELETE FROM loans WHERE id = ?", [id]);
  });
}

export async function insertPayments(payments: LoanPaymentInput[], excess?: LoanExcessInput): Promise<void> {
  const db = await getDB();
  await withWriteTransaction(db, async (txn) => {
    for (const accountId of uniq(payments.map((p) => p.accountId))) {
      const isKnownAccount = await hasAccount(txn, accountId);
      if (!isKnownAccount) {
        throw new Error("Account not found");
      }
    }
    for (const p of payments) {
      await insertRow(txn, {
        accountId: p.accountId, kind: "loan_in", amount: p.amount, expenseId: null, cycleYear: null,
        cycleMonth: null, transferId: null, note: null, category: null, loanId: p.loanId, createdAt: p.paidAt,
      });
    }
    if (!excess) {
      return;
    }
    const last = payments.at(-1);
    if (!last) {
      throw new Error("Nothing to record");
    }
    await insertRow(txn, {
      accountId: last.accountId, kind: "income", amount: excess.amount, expenseId: null, cycleYear: null,
      cycleMonth: null, transferId: null, note: null, category: excess.category, loanId: last.loanId, createdAt: last.paidAt,
    });
    await touchCategory(excess.category, undefined, "income", txn);
  });
}

// Restores a loan from a backup. Pass the import's transaction as `db`; returns 1 when added, 0 when it already
// existed. Unlike insert, it writes no "loan out" transaction: backups carry that row themselves.
export async function insertWithId(l: Loan, db?: SQLiteDatabase): Promise<number> {
  const conn = db ?? (await getDB());
  const { type: interestType, value: interestValue } = fromLoanInterest(l.interest);
  const result = await conn.runAsync(
    `INSERT OR IGNORE INTO loans (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [l.id, l.borrower, l.principal, l.accountId, l.lentAt, interestType, interestValue, l.note ?? null, l.createdAt]
  );
  return result.changes;
}
