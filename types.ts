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
