import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { withWriteTransaction } from "@/db/withWriteTransaction";
import { writeLedgerChange, type TLedgerChange } from "@/db/accountTransactions";
import { insert, remove, update, updateStatus, type ExpenseFields } from "@/db/expenses";
import { setMonth, upsertMonthlyAmount } from "@/db/expenseMonths";
import type { AccountTransaction, Expense, MonthStatus, Status } from "@/types";

export interface TMonthAmount {
  year: number;
  month: number;
  amount: number | null;
}

interface TExpenseWrite {
  monthAmount?: TMonthAmount;
  ledger?: TLedgerChange;
}

// Every write here commits the expense, its month and its account rows together or not at all, and returns the
// account rows it added.
async function write(task: (txn: SQLiteDatabase) => Promise<void>, ledger: TLedgerChange = {}): Promise<AccountTransaction[]> {
  const db = await getDB();
  let inserted: AccountTransaction[] = [];
  await withWriteTransaction(db, async (txn) => {
    await task(txn);
    inserted = await writeLedgerChange(txn, ledger);
  });
  return inserted;
}

export async function insertExpense(expense: Expense, { monthAmount, ledger }: TExpenseWrite = {}): Promise<AccountTransaction[]> {
  return write(async (txn) => {
    await insert(txn, expense);
    if (monthAmount) {
      await upsertMonthlyAmount(txn, expense.id, monthAmount.year, monthAmount.month, monthAmount.amount);
    }
  }, ledger);
}

export async function editExpense(
  id: string,
  fields: ExpenseFields,
  { monthAmount, ledger }: TExpenseWrite = {}
): Promise<AccountTransaction[]> {
  return write(async (txn) => {
    await update(txn, id, fields);
    if (monthAmount) {
      await upsertMonthlyAmount(txn, id, monthAmount.year, monthAmount.month, monthAmount.amount);
    }
  }, ledger);
}

export async function setExpenseStatus(id: string, status: Status, ledger?: TLedgerChange): Promise<AccountTransaction[]> {
  return write((txn) => updateStatus(txn, id, status), ledger);
}

export async function setMonthState(month: MonthStatus, ledger?: TLedgerChange): Promise<AccountTransaction[]> {
  return write(
    (txn) => setMonth(txn, month.expenseId, month.year, month.month, month.status, month.amount ?? null, month.paidAt ?? null),
    ledger
  );
}

export async function removeExpense(id: string, ledger?: TLedgerChange): Promise<AccountTransaction[]> {
  return write((txn) => remove(txn, id), ledger);
}
