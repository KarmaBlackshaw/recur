export type Recurrence = 'weekly' | 'monthly' | 'yearly' | 'one-off';
export type Status = 'unpaid' | 'paid';

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;        // 1–31, anchor day of month
  recurrence: Recurrence;
  status: Status;
  notes?: string;
  createdAt: string;
}

export interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  notes: string;
}

export interface MonthStatus {
  expenseId: string;
  year: number;
  month: number;   // 0-based (JS Date.getMonth())
  status: Status;
}
