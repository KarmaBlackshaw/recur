import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import uniqBy from 'lodash/uniqBy';

import { getAll as getAllExpenses, insertWithId as insertExpenseWithId } from '@/db/expenses';
import { getAll as getAllCategories, insertCategory } from '@/db/categories';
import { getAll as getAllAccounts, insertWithId as insertAccountWithId } from '@/db/accounts';
import { getAll as getAllTransactions, insertWithId as insertTransactionWithId } from '@/db/accountTransactions';
import { getAll as getAllMonths, insertOrIgnore as insertMonth } from '@/db/expenseMonths';
import { getAll as getAllCardBills, insertOrIgnore as insertCardBill } from '@/db/cardBills';
import { getAll as getAllLoans, insertWithId as insertLoanWithId } from '@/db/loans';
import { getPreference, setPreference } from '@/db/preferences';
import { backfillExpenseHistory, getDB } from '@/db/schema';
import { withWriteTransaction } from '@/db/withWriteTransaction';
import { CASH_ACCOUNT_ID } from '@/constants/accounts';
import { PREF_LAST_BACKUP_AT } from '@/constants/preferences';
import { LOGO_DIR } from '@/utils/accountLogo/logoDir';
import { resolveAccountLogo } from '@/utils/accountLogo/resolveAccountLogo';
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

const BACKUP_VERSION = 5;

// The settings a backup carries. Migration flags and the permission prompt flag belong to the device.
const BACKUP_PREFERENCE_KEYS = ['user_name', 'reminderTime', 'notificationsEnabled', 'homeCollapsedBands'];

const NOT_A_BACKUP = "This file isn't a Recur backup.";
const NEWER_BACKUP = 'This backup was made by a newer version of Recur. Update the app and try again.';
const DAMAGED_BACKUP = 'This backup is damaged or incomplete.';

interface BackupLogo {
  accountId: string;
  filename: string;
  data: string; // base64 file contents
}

interface BackupFile {
  version: 1 | 2 | 3 | 4 | 5;
  exportedAt: string;
  expenses: Expense[];
  categories: string[];
  incomeCategories?: string[];
  accounts?: Account[];
  transactions?: AccountTransaction[];
  months?: MonthStatus[];
  cardBills?: CardBillOverride[];
  loans?: Loan[];
  preferences?: Record<string, string>;
  logos?: BackupLogo[];
}

type BackupContents = Required<Omit<BackupFile, 'version' | 'exportedAt'>>;

export interface ImportSummary {
  added: {
    expenses: number;
    accounts: number;
    loans: number;
    transactions: number;
    categories: number;
    months: number;
    cardBills: number;
    preferences: number;
  };
  alreadyHere: number; // rows that already existed (INSERT OR IGNORE no-op)
  unlinked: number; // transactions/months/bills skipped because their account or expense is missing
}

type TRestoredRowKind = 'expenses' | 'accounts' | 'loans' | 'transactions' | 'months' | 'cardBills';

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

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArrayOf<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isValidExpense(value: unknown): value is Expense {
  return (
    isRecord(value) &&
    REQUIRED_EXPENSE_FIELDS.every((field) => value[field] !== undefined && value[field] !== null) &&
    typeof value.recurrence === 'string' &&
    RECURRENCES.includes(value.recurrence)
  );
}

function isValidAccount(value: unknown): value is Account {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    ACCOUNT_TYPES.includes(value.type) &&
    typeof value.createdAt === 'string'
  );
}

function isValidTransaction(value: unknown): value is AccountTransaction {
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

function isValidLoan(value: unknown): value is Loan {
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

function isValidMonth(value: unknown): value is MonthStatus {
  return (
    isRecord(value) &&
    typeof value.expenseId === 'string' &&
    typeof value.year === 'number' &&
    typeof value.month === 'number' &&
    (value.status === 'paid' || value.status === 'unpaid')
  );
}

function isValidCardBill(value: unknown): value is CardBillOverride {
  return (
    isRecord(value) &&
    typeof value.accountId === 'string' &&
    typeof value.year === 'number' &&
    typeof value.month === 'number' &&
    typeof value.amount === 'number'
  );
}

function isValidPreferences(value: unknown): value is Record<string, string> {
  return isRecord(value) && !Array.isArray(value) && Object.values(value).every(isString);
}

function isValidLogo(value: unknown): value is BackupLogo {
  return (
    isRecord(value) &&
    typeof value.accountId === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.data === 'string'
  );
}

function parseBackup(content: string): BackupContents {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error(NOT_A_BACKUP);
  }
  const { version } = parsed;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(NOT_A_BACKUP);
  }
  if (version > BACKUP_VERSION) {
    throw new Error(NEWER_BACKUP);
  }

  const { expenses, categories } = parsed;
  const incomeCategories = parsed.incomeCategories ?? [];
  const accounts = parsed.accounts ?? [];
  const transactions = parsed.transactions ?? [];
  const loans = parsed.loans ?? [];
  const months = parsed.months ?? [];
  const cardBills = parsed.cardBills ?? [];
  const preferences = parsed.preferences ?? {};
  const logos = parsed.logos ?? [];
  if (
    !isArrayOf(expenses, isValidExpense) ||
    !Array.isArray(categories) ||
    !Array.isArray(incomeCategories) ||
    !isArrayOf(accounts, isValidAccount) ||
    !isArrayOf(transactions, isValidTransaction) ||
    !isArrayOf(loans, isValidLoan) ||
    !isArrayOf(months, isValidMonth) ||
    !isArrayOf(cardBills, isValidCardBill) ||
    !isValidPreferences(preferences) ||
    !isArrayOf(logos, isValidLogo)
  ) {
    throw new Error(DAMAGED_BACKUP);
  }

  return {
    expenses,
    categories: categories.filter(isString),
    incomeCategories: incomeCategories.filter(isString),
    accounts,
    transactions,
    loans,
    months,
    cardBills,
    preferences,
    logos,
  };
}

async function readPreferences(): Promise<Record<string, string>> {
  const preferences: Record<string, string> = {};
  for (const key of BACKUP_PREFERENCE_KEYS) {
    const value = await getPreference(key);
    if (value !== null) {
      preferences[key] = value;
    }
  }
  return preferences;
}

async function readLogos(accounts: Account[]): Promise<BackupLogo[]> {
  const logos: BackupLogo[] = [];
  for (const account of accounts) {
    if (!account.logoUri) {
      continue;
    }
    try {
      const data = await FileSystem.readAsStringAsync(resolveAccountLogo(account.logoUri), {
        encoding: FileSystem.EncodingType.Base64,
      });
      logos.push({ accountId: account.id, filename: account.logoUri.split('/').pop() ?? account.logoUri, data });
    } catch {
      // The logo file is gone or unreadable: the account is still exported, just without its picture.
    }
  }
  return logos;
}

// Keeps the logo's own extension when it looks like one, so a restored file name can't point outside LOGO_DIR.
function logoExtension(filename: string): string {
  return /\.([A-Za-z0-9]{1,5})$/.exec(filename)?.[1] ?? 'jpg';
}

// Logos are files, so they can't join the database transaction: accounts new to this device get theirs written
// first, under a fresh name. Every path goes into `written` before it is written, so a failed import can delete
// them all again.
async function restoreLogos(
  accounts: Account[],
  logos: BackupLogo[],
  existingAccountIds: Set<string>,
  written: string[],
): Promise<Account[]> {
  const newAccountIds = new Set(accounts.map((a) => a.id).filter((id) => !existingAccountIds.has(id)));
  const pending = uniqBy(
    logos.filter((logo) => newAccountIds.has(logo.accountId)),
    'accountId',
  );
  if (pending.length === 0) {
    return accounts;
  }

  await FileSystem.makeDirectoryAsync(LOGO_DIR, { intermediates: true });
  const logoUris = new Map<string, string>();
  for (const logo of pending) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${logoExtension(logo.filename)}`;
    const path = `${LOGO_DIR}${filename}`;
    written.push(path);
    await FileSystem.writeAsStringAsync(path, logo.data, { encoding: FileSystem.EncodingType.Base64 });
    logoUris.set(logo.accountId, filename);
  }
  return accounts.map((account) => {
    const logoUri = logoUris.get(account.id);
    return logoUri ? { ...account, logoUri } : account;
  });
}

async function deleteFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => FileSystem.deleteAsync(path, { idempotent: true })));
}

function tally(summary: ImportSummary, kind: TRestoredRowKind, changes: number): void {
  summary.added[kind] += changes;
  summary.alreadyHere += 1 - changes;
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
  const preferences = await readPreferences();
  const logos = await readLogos(accounts);

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    expenses,
    categories,
    incomeCategories,
    accounts,
    transactions,
    months,
    cardBills,
    loans,
    preferences,
    logos,
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
  // The share sheet can't tell whether the file was saved anywhere, so closing it counts as a backup.
  await setPreference(PREF_LAST_BACKUP_AT, new Date().toISOString());
}

// Merges a backup into this device, all or nothing: every row goes in through one transaction, and anything
// that throws rolls it back and deletes the logos it wrote. Rows already here are kept as they are.
export async function importBackup(): Promise<ImportSummary | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const backup = parseBackup(await FileSystem.readAsStringAsync(result.assets[0].uri));

  const [existingExpenses, existingCategories, existingIncomeCategories, existingAccounts] = await Promise.all([
    getAllExpenses(),
    getAllCategories(),
    getAllCategories('income'),
    getAllAccounts(),
  ]);
  const existingCategorySet = new Set(existingCategories);
  const existingIncomeCategorySet = new Set(existingIncomeCategories);
  const existingAccountIds = new Set(existingAccounts.map((a) => a.id));
  const knownAccountIds = new Set([...existingAccountIds, ...backup.accounts.map((a) => a.id)]);
  const knownExpenseIds = new Set([...existingExpenses.map((e) => e.id), ...backup.expenses.map((e) => e.id)]);

  const summary: ImportSummary = {
    added: { expenses: 0, accounts: 0, loans: 0, transactions: 0, categories: 0, months: 0, cardBills: 0, preferences: 0 },
    alreadyHere: 0,
    unlinked: 0,
  };
  const writtenLogos: string[] = [];

  try {
    const accounts = await restoreLogos(backup.accounts, backup.logos, existingAccountIds, writtenLogos);

    const db = await getDB();
    await withWriteTransaction(db, async (txn) => {
      for (const name of backup.categories) {
        if (!existingCategorySet.has(name)) {
          summary.added.categories += await insertCategory(name, 'expense', txn);
        }
      }
      for (const name of backup.incomeCategories) {
        if (!existingIncomeCategorySet.has(name)) {
          summary.added.categories += await insertCategory(name, 'income', txn);
        }
      }
      for (const expense of backup.expenses) {
        tally(summary, 'expenses', await insertExpenseWithId(expense, txn));
      }
      for (const account of accounts) {
        const changes = await insertAccountWithId(account, txn);
        // Every device has the built-in Cash account, so finding it isn't worth reporting.
        if (account.id !== CASH_ACCOUNT_ID) {
          tally(summary, 'accounts', changes);
        }
      }
      for (const loan of backup.loans) {
        tally(summary, 'loans', await insertLoanWithId(loan, txn));
      }
      for (const transaction of backup.transactions) {
        if (knownAccountIds.has(transaction.accountId)) {
          tally(summary, 'transactions', await insertTransactionWithId(transaction, txn));
        } else {
          summary.unlinked++;
        }
      }
      for (const month of backup.months) {
        if (knownExpenseIds.has(month.expenseId)) {
          tally(summary, 'months', await insertMonth(month, txn));
        } else {
          summary.unlinked++;
        }
      }
      for (const bill of backup.cardBills) {
        if (knownAccountIds.has(bill.accountId)) {
          tally(summary, 'cardBills', await insertCardBill(bill, txn));
        } else {
          summary.unlinked++;
        }
      }
      // Settings only fill gaps: anything already set on this device wins.
      for (const key of BACKUP_PREFERENCE_KEYS) {
        const value = backup.preferences[key];
        if (value !== undefined && (await getPreference(key, txn)) === null) {
          await setPreference(key, value, txn);
          summary.added.preferences++;
        }
      }

      // Older backups have no start months or paid amounts; fill them in the same way an app update does.
      await backfillExpenseHistory(txn);
    });
  } catch (error) {
    try {
      await deleteFiles(writtenLogos);
    } catch (cleanupError) {
      console.error('Removing restored logos failed', cleanupError);
    }
    throw error;
  }

  return summary;
}

const SUMMARY_KINDS: [kind: 'expenses' | 'accounts' | 'loans' | 'transactions', noun: string][] = [
  ['expenses', 'expense'],
  ['accounts', 'account'],
  ['loans', 'loan'],
  ['transactions', 'transaction'],
];

function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function joinWithAnd(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join('');
}

// "Added 12 expenses, 2 accounts, 3 loans and 45 transactions. 5 were already here."
export function formatImportSummary({ added, alreadyHere, unlinked }: ImportSummary): string {
  const sentences: string[] = [];
  const nothingAdded = Object.values(added).every((count) => count === 0);

  if (nothingAdded && unlinked === 0) {
    return 'Nothing new to add. Everything in this backup is already here.';
  }
  if (nothingAdded) {
    sentences.push('Nothing new to add.');
  }

  const records = SUMMARY_KINDS.filter(([kind]) => added[kind] > 0).map(([kind, noun]) => countOf(added[kind], noun));
  if (records.length > 0) {
    sentences.push(`Added ${joinWithAnd(records)}.`);
  } else {
    // Only smaller pieces were new, e.g. paid months of expenses that were already here.
    const details = [
      added.categories > 0 ? countOf(added.categories, 'category', 'categories') : null,
      added.months > 0 || added.cardBills > 0 ? 'missing history' : null,
    ].filter(isString);
    if (details.length > 0) {
      sentences.push(`Added ${joinWithAnd(details)}.`);
    }
  }
  if (added.preferences > 0) {
    sentences.push('Your settings were restored.');
  }
  if (alreadyHere > 0) {
    sentences.push(`${alreadyHere} ${alreadyHere === 1 ? 'was' : 'were'} already here.`);
  }
  if (unlinked > 0) {
    sentences.push(
      unlinked === 1
        ? '1 was skipped because its account or expense is missing.'
        : `${unlinked} were skipped because their account or expense is missing.`,
    );
  }
  return sentences.join(' ');
}
