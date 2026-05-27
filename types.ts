export type Recurrence = 'weekly' | 'monthly' | 'yearly' | 'one-off';
export type Status = 'unpaid' | 'paid';

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDate: string;        // ISO date YYYY-MM-DD
  recurrence: Recurrence;
  status: Status;
  notes?: string;
  createdAt: string;
}
