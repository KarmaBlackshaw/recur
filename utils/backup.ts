import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { getAll as getAllExpenses, insertWithId } from '../db/expenses';
import { getAll as getAllCategories, insertCategory } from '../db/categories';
import type { Expense } from '../types';

interface BackupFile {
  version: 1;
  exportedAt: string;
  expenses: Expense[];
  categories: string[];
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

export async function exportBackup(): Promise<void> {
  const expenses = await getAllExpenses();
  const categories = await getAllCategories();

  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    categories,
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

  if (backup.version !== 1) {
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

  return { added, skipped };
}
