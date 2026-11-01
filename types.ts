import type Feather from "@expo/vector-icons/Feather";
import type { BankId } from "@/constants/banks";
import type { IoniconName } from "@/constants/ionicons";
import type { BillSummary } from "@/utils/cardBills";

export type { IoniconName };
export type FeatherIconName = keyof typeof Feather.glyphMap;
export type Recurrence = 'monthly' | 'yearly' | 'one-off';
export type Status = 'unpaid' | 'paid';
export type HomeBandSlot = 'current' | 'next';
export type ActivitySegment = "all" | "paid" | "charged" | "income" | "transfers" | "loans";

export interface TOption<T> {
  label: string;
  value: T;
}

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
  startYear?: number | null;   // first month with a cycle (yearly: also the month it's due every year). Null for one-off.
  startMonth?: number | null;  // 0-based month.
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
  startDate: string;  // ISO date string, first-of-start-month (recurring only)
  hasEndDate: boolean;
  endDate: string;   // ISO date string, first-of-end-month (recurring only)
  accountId: string;
}

export interface MonthStatus {
  expenseId: string;
  year: number;
  month: number;
  status: Status;
  amount?: number | null;   // Variable: that month's amount. Paid: what the month cost when paid, so editing the expense never rewrites history.
  paidAt?: string | null;   // ISO timestamp — when this recurring month was marked paid. Null when unpaid/unknown.
}

export type AccountType = 'debit' | 'credit' | 'cash';
export type InterestPeriod = 'daily' | 'monthly' | 'yearly';
export type TransactionKind = 'payment' | 'interest' | 'tax' | 'transfer' | 'fee' | 'adjust' | 'income' | 'loan_out' | 'loan_in';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  debit: 'Debit account',
  credit: 'Credit card',
  cash: 'Cash',
};

export interface InterestEstimate {
  amount: number;
  period: InterestPeriod;
}

export const INTEREST_PERIOD_UNIT: Record<InterestPeriod, { short: string; long: string }> = {
  daily: { short: 'day', long: 'day' },
  monthly: { short: 'mo', long: 'month' },
  yearly: { short: 'yr', long: 'year' },
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  payment: 'Payment',
  interest: 'Interest',
  tax: 'Tax withheld',
  transfer: 'Transfer',
  fee: 'Transfer fee',
  adjust: 'Adjustment',
  income: 'Income',
  loan_out: 'Loan out',
  loan_in: 'Loan repayment',
};

export type TLoanInterest =
  | { type: 'none' }
  | { type: 'fixed'; amount: number }
  | { type: 'percent_once' | 'monthly_principal' | 'monthly_balance'; rate: number };

export type TLoanInterestType = TLoanInterest['type'];

export const LOAN_INTEREST_TYPE_LABEL: Record<TLoanInterestType, string> = {
  none: 'None',
  fixed: 'Fixed amount',
  percent_once: '% once',
  monthly_principal: '% monthly (original)',
  monthly_balance: '% monthly (remaining)',
};

export interface Loan {
  id: string;
  borrower: string;
  principal: number;
  accountId: string | null;   // null = lent before Recur (no loan_out). A dangling id = deleted account.
  lentAt: string;
  interest: TLoanInterest;
  note: string | null;
  createdAt: string;
}

export type LoanInput = Omit<Loan, 'id' | 'createdAt'>;

export interface LoanPaymentInput {
  loanId: string;
  accountId: string;
  amount: number;
  paidAt: string;
}

// Saved as income beside the last payment: its loan, account and date.
export interface LoanExcessInput {
  amount: number;
  category: string;
}

export type TLoanPayment = Pick<AccountTransaction, 'amount' | 'createdAt'>;
export type TLoanTerms = Pick<Loan, 'principal' | 'lentAt' | 'interest'>;

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
  bank: BankId | null;
  archivedAt: string | null;   // ISO timestamp. Archived accounts keep their history but leave pickers, bills and interest.
  createdAt: string;
}

export interface AccountBankGroup {
  key: BankId | 'other';
  label: string;
  accounts: Account[];
}

export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'sortOrder' | 'interestAccruedThrough' | 'archivedAt'>;

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
  loanId: string | null;
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

export interface TransferInput {
  fromId: string;
  toId: string;
  amount: number;
  fee: number;              // paid by you — deducted from From
  income: number;           // earned on the transfer (e.g. a cash-out fee)
  incomeAccountId: string;  // where the income lands — usually To
  note: string | null;
  createdAt?: string;       // when it happened; defaults to now
}
