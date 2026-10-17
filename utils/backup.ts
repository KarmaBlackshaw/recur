import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { getAll as getAllExpenses, insertWithId } from '@/db/expenses';
import { getAll as getAllCategories, insertCategory } from '@/db/categories';
import { getAll as getAllAccounts, insertWithId as insertAccountWithId } from '@/db/accounts';
import { getAll as getAllTransactions, insertWithId as insertTransactionWithId } from '@/db/accountTransactions';
import type { Account, AccountTransaction, Expense } from '@/types';

interface BackupFile {
  version: 1 | 2;
  exportedAt: string;
  expenses: Expense[];
  categories: string[];
  accounts?: Account[];
  transactions?: AccountTransaction[];
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

const ACCOUNT_TYPES = ['debit', 'credit', 'cash'];
const TRANSACTION_KINDS = ['payment', 'interest', 'tax', 'transfer', 'adjust'];

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

export async function exportBackup(): Promise<void> {
  const expenses = await getAllExpenses();
  const categories = await getAllCategories();
  const accounts = await getAllAccounts();
  const transactions = await getAllTransactions();

  const backup: BackupFile = {
    version: 2,
    exportedAt: new Date().toISOString(),
    expenses,
    categories,
    accounts,
    transactions,
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

  if (backup.version !== 1 && backup.version !== 2) {
    throw new Error('Unsupported backup version.');
  }

  if (!Array.isArray(backup.expenses) || !Array.isArray(backup.categories)) {
    throw new Error('Backup file is corrupted — missing required fields.');
  }

  for (const expense of backup.expenses) {
    const missing = REQUIRED_EXPENSE_FIELDS.some(
      (field) => expense[field] === undefined || expense[field] === null,
    );
    if (missing) {
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

  const existingAccounts = await getAllAccounts();
  const knownAccountIds = new Set([
    ...existingAccounts.map((a) => a.id),
    ...backupAccounts.map((a) => a.id),
  ]);

  for (const account of backupAccounts) {
    await insertAccountWithId(account);
  }
  for (const transaction of backupTransactions) {
    if (knownAccountIds.has(transaction.accountId)) {
      await insertTransactionWithId(transaction);
    } else {
      skipped++;
    }
  }

  return { added, skipped };
}
