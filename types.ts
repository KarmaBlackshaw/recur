import type { Feather } from "@expo/vector-icons";

export type FeatherIconName = keyof typeof Feather.glyphMap;
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
}

export interface ExpenseFormValues {
  name: string;
  amount: string;
  category: string;
  dueDay: string;
  recurrence: Recurrence;
  isVariable: boolean;
  monthlyAmount: string;
  notes: string;
  reminderDaysBefore: string;
}

export interface MonthStatus {
  expenseId: string;
  year: number;
  month: number;
  status: Status;
  amount?: number | null;
}
