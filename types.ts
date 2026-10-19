import type { Feather, Ionicons } from "@expo/vector-icons";
import type { BillSummary } from "@/utils/cardBills";

export type FeatherIconName = keyof typeof Feather.glyphMap;
export type IoniconName = keyof typeof Ionicons.glyphMap;
export type Recurrence = 'weekly' | 'monthly' | 'yearly' | 'one-off';
export type Status = 'unpaid' | 'paid';

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number | null;
  dueDay: number;        // 1–31, anchor day of month
  recurrence: Recurrence;
  status: Status;
  isVariable: boolean;
  notes?: string;
  createdAt: string;
  reminderDaysBefore?: number | null;
  paidDate?: string | null;   // ISO date — when a one-off was paid (default today on insert). Null for recurring.
  endYear?: number | null;   // recurring end anchor — year. NULL = open-ended. Always null for one-off.
  endMonth?: number | null;  // 0-based month. NULL = open-ended.
  accountId?: string | null;
}

export interface ExpenseFormValues {
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  isVariable: boolean;
  monthlyAmount: string;
  notes: string;
  reminderDaysBefore: string;
  paidDate: string;   // ISO date string (one-off only)
  hasEndDate: boolean;
  endDate: string;   // ISO date string, first-of-end-month (recurring only)
  accountId: string;
}

export interface MonthStatus {
  expenseId: string;
  year: number;
  month: number;
  status: Status;
  amount?: number | null;
  paidAt?: string | null;   // ISO timestamp — when this recurring month was marked paid. Null when unpaid/unknown.
}

export type AccountType = 'debit' | 'credit' | 'cash';
export type InterestPeriod = 'daily' | 'monthly' | 'yearly';
export type TransactionKind = 'payment' | 'interest' | 'tax' | 'transfer' | 'fee' | 'adjust' | 'income';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  debit: 'Debit account',
  credit: 'Credit card',
  cash: 'Cash',
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  payment: 'Payment',
  interest: 'Interest',
  tax: 'Tax withheld',
  transfer: 'Transfer',
  fee: 'Transfer fee',
  adjust: 'Adjustment',
  income: 'Income',
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  sortOrder: number;
  interestRate: number | null;
  interestPeriod: InterestPeriod | null;
  taxRate: number | null;
  interestAccruedThrough: string | null;   // YYYY-MM-DD
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  color: string | null;
  icon: IoniconName | null;
  logoUri: string | null;
  createdAt: string;
}

export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'sortOrder' | 'interestAccruedThrough'>;

export interface CardBillOverride {
  accountId: string;
  year: number;
  month: number;
  amount: number;
}

export type CardBill = BillSummary & { account: Account; year: number; month: number };

export interface AccountTransaction {
  id: string;
  accountId: string;
  kind: TransactionKind;
  amount: number;
  expenseId: string | null;
  cycleYear: number | null;
  cycleMonth: number | null;
  transferId: string | null;
  note: string | null;
  category: string | null;
  createdAt: string;
}

export type CategoryKind = 'expense' | 'income';

export interface IncomeInput {
  accountId: string;
  amount: number;
  category: string;
  note: string | null;
  receivedAt: string;
}
