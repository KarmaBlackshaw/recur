import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { getAll as getAllExpenses, insertWithId } from '@/db/expenses';
import { getAll as getAllCategories, insertCategory } from '@/db/categories';
import { getAll as getAllAccounts, insertWithId as insertAccountWithId } from '@/db/accounts';
import { getAll as getAllTransactions, insertWithId as insertTransactionWithId } from '@/db/accountTransactions';
import { getAll as getAllMonths, insertOrIgnore as insertMonth } from '@/db/expenseMonths';
import { getAll as getAllCardBills, insertOrIgnore as insertCardBill } from '@/db/cardBills';
import { getAll as getAllLoans, insertWithId as insertLoanWithId } from '@/db/loans';
import { backfillExpenseHistory, getDB } from '@/db/schema';
import {
  TRANSACTION_KIND_LABEL,
  LOAN_INTEREST_TYPE_LABEL,
  type Account,
  type AccountTransaction,
  type CardBillOverride,
  type Expense,
  type Loan,
  type MonthStatus,
} from '@/types';

interface BackupFile {
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  expenses: Expense[];
  categories: string[];
  incomeCategories?: string[];
  accounts?: Account[];
  transactions?: AccountTransaction[];
  months?: MonthStatus[];
  cardBills?: CardBillOverride[];
  loans?: Loan[];
}

const REQUIRED_EXPENSE_FIELDS: (keyof Expense)[] = [
  'id',
  'name',
  'category',
  'dueDay',
  'recurrence',
  'status',
  'createdAt',
];

// 'weekly' is accepted from older backups; backfillExpenseHistory turns it into 'monthly'.
const RECURRENCES = ['weekly', 'monthly', 'yearly', 'one-off'];

const ACCOUNT_TYPES = ['debit', 'credit', 'cash'];
const TRANSACTION_KINDS = Object.keys(TRANSACTION_KIND_LABEL);
const LOAN_INTEREST_TYPES = Object.keys(LOAN_INTEREST_TYPE_LABEL);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidAccount(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    ACCOUNT_TYPES.includes(value.type) &&
    typeof value.createdAt === 'string'
  );
}

function isValidTransaction(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.accountId === 'string' &&
    typeof value.kind === 'string' &&
    TRANSACTION_KINDS.includes(value.kind) &&
    typeof value.amount === 'number' &&
    typeof value.createdAt === 'string'
  );
}

function isValidLoan(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.borrower !== 'string' ||
    typeof value.accountId !== 'string' ||
    typeof value.lentAt !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.principal !== 'number' ||
    !isRecord(value.interest) ||
    typeof value.interest.type !== 'string' ||
    !LOAN_INTEREST_TYPES.includes(value.interest.type)
  ) {
    return false;
  }
  const { type } = value.interest;
  if (type === 'fixed') {
    return typeof value.interest.amount === 'number';
  }
  if (type === 'none') {
    return true;
  }
  return typeof value.interest.rate === 'number';
}

function isValidMonth(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.expenseId === 'string' &&
    typeof value.year === 'number' &&
    typeof value.month === 'number' &&
    (value.status === 'paid' || value.status === 'unpaid')
  );
}

function isValidCardBill(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.accountId === 'string' &&
    typeof value.year === 'number' &&
    typeof value.month === 'number' &&
    typeof value.amount === 'number'
  );
}

export async function exportBackup(): Promise<void> {
  const expenses = await getAllExpenses();
  const categories = await getAllCategories();
  const incomeCategories = await getAllCategories('income');
  const accounts = await getAllAccounts();
  const transactions = await getAllTransactions();
  const months = await getAllMonths();
  const cardBills = await getAllCardBills();
  const loans = await getAllLoans();

  const backup: BackupFile = {
    version: 4,
    exportedAt: new Date().toISOString(),
    expenses,
    categories,
    incomeCategories,
    accounts,
    transactions,
    months,
    cardBills,
    loans,
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}recur-backup-${dateSlug}.json`;

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error('Sharing not available on this device.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Recur Backup',
  });
}

export async function importBackup(): Promise<{ added: number; skipped: number } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  const backup = parsed as Partial<BackupFile>;

  if (backup.version !== 1 && backup.version !== 2 && backup.version !== 3 && backup.version !== 4) {
    throw new Error('Unsupported backup version.');
  }

  if (!Array.isArray(backup.expenses) || !Array.isArray(backup.categories)) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }

  const backupExpenseIds: string[] = [];
  for (const expense of backup.expenses) {
    backupExpenseIds.push(expense.id);
    const missing = REQUIRED_EXPENSE_FIELDS.some(
      (field) => expense[field] === undefined || expense[field] === null,
    );
    if (missing || !RECURRENCES.includes(expense.recurrence)) {
      throw new Error('Backup file is corrupted — missing required fields.');
    }
  }

  const backupAccounts = backup.accounts ?? [];
  const backupTransactions = backup.transactions ?? [];
  if (
    !Array.isArray(backupAccounts) ||
    !Array.isArray(backupTransactions) ||
    !backupAccounts.every(isValidAccount) ||
    !backupTransactions.every(isValidTransaction)
  ) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }

  const backupLoans = backup.loans ?? [];
  if (!Array.isArray(backupLoans) || !backupLoans.every(isValidLoan)) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }

  const backupMonths = backup.months ?? [];
  const backupCardBills = backup.cardBills ?? [];
  if (
    !Array.isArray(backupMonths) ||
    !Array.isArray(backupCardBills) ||
    !backupMonths.every(isValidMonth) ||
    !backupCardBills.every(isValidCardBill)
  ) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }

  const existingExpenses = await getAllExpenses();
  const existingIds = new Set(existingExpenses.map((e) => e.id));

  let added = 0;
  let skipped = 0;

  for (const expense of backup.expenses as Expense[]) {
    if (existingIds.has(expense.id)) {
      skipped++;
    } else {
      await insertWithId(expense);
      added++;
    }
  }

  const existingCategories = await getAllCategories();
  const existingCatSet = new Set(existingCategories);

  for (const cat of backup.categories as string[]) {
    if (!existingCatSet.has(cat)) {
      await insertCategory(cat);
    }
  }

  const backupIncomeCategories = backup.incomeCategories ?? [];
  if (!Array.isArray(backupIncomeCategories)) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }
  const existingIncomeCatSet = new Set(await getAllCategories('income'));
  for (const cat of backupIncomeCategories) {
    if (typeof cat === 'string' && !existingIncomeCatSet.has(cat)) {
      await insertCategory(cat, 'income');
    }
  }

  const existingAccounts = await getAllAccounts();
  const knownAccountIds = new Set([
    ...existingAccounts.map((a) => a.id),
    ...backupAccounts.map((a) => a.id),
  ]);

  for (const account of backupAccounts) {
    await insertAccountWithId(account);
  }
  for (const loan of backupLoans) {
    await insertLoanWithId(loan);
  }
  for (const transaction of backupTransactions) {
    if (knownAccountIds.has(transaction.accountId)) {
      await insertTransactionWithId(transaction);
    } else {
      skipped++;
    }
  }

  const knownExpenseIds = new Set([...existingIds, ...backupExpenseIds]);
  for (const month of backupMonths) {
    if (knownExpenseIds.has(month.expenseId)) {
      await insertMonth(month);
    } else {
      skipped++;
    }
  }
  for (const bill of backupCardBills) {
    if (knownAccountIds.has(bill.accountId)) {
      await insertCardBill(bill);
    } else {
      skipped++;
    }
  }

  // Older backups have no start months or paid amounts; fill them in the same way an app update does.
  await backfillExpenseHistory(await getDB());

  return { added, skipped };
}
