import { getDB } from "./schema";
import { insertWithId } from "./expenses";
import type { Expense } from "../types";

// ponytail: dev-only dummy data. Triggered by the "Seed dummy data" button in
// the __DEV__ Dev Tools section of app/settings.tsx (hidden in prod builds).
// Remove this block + that button when you're done demoing.
const DUMMY: Omit<Expense, "createdAt">[] = [
  { id: "seed-01", name: "Rent", category: "Housing", amount: 1500, dueDay: 1, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-02", name: "Electricity", category: "Utilities", amount: 85, dueDay: 5, recurrence: "monthly", status: "unpaid", isVariable: true },
  { id: "seed-03", name: "Netflix", category: "Subscriptions", amount: 15.99, dueDay: 12, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-04", name: "Spotify", category: "Subscriptions", amount: 9.99, dueDay: 8, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-05", name: "Car Insurance", category: "Insurance", amount: 120, dueDay: 15, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-06", name: "Gym", category: "Health", amount: 40, dueDay: 3, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-07", name: "Internet", category: "Utilities", amount: 60, dueDay: 20, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-08", name: "Phone", category: "Utilities", amount: 45, dueDay: 18, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-09", name: "Groceries", category: "Food", amount: 400, dueDay: 25, recurrence: "monthly", status: "unpaid", isVariable: true },
  { id: "seed-10", name: "Student Loan", category: "Debt", amount: 250, dueDay: 28, recurrence: "monthly", status: "unpaid", isVariable: false },
  { id: "seed-11", name: "Amazon Prime", category: "Subscriptions", amount: 139, dueDay: 10, recurrence: "yearly", status: "unpaid", isVariable: false },
  { id: "seed-12", name: "Coffee run", category: "Food", amount: 6, dueDay: 9, recurrence: "one-off", status: "paid", isVariable: false },
  { id: "seed-13", name: "New headphones", category: "Other", amount: 199, dueDay: 2, recurrence: "one-off", status: "paid", isVariable: false },
];

// Insert dummy expenses + backfill paid month-history. Idempotent: insertWithId
// is INSERT OR IGNORE on the fixed seed-NN ids, so re-running never duplicates.
async function seed(expenses: Omit<Expense, "createdAt">[]): Promise<void> {
  const createdAt = new Date().toISOString();
  const full: Expense[] = expenses.map((e) => ({ ...e, createdAt }));
  for (const e of full) await insertWithId(e);
  // Give recurring expenses a few months of paid history for KPI variety.
  await seedTestData(full.filter((e) => e.recurrence !== "one-off"));
}

export async function seedRecurring(): Promise<void> {
  await seed(DUMMY.filter((e) => e.recurrence !== "one-off"));
}

export async function seedOneOff(): Promise<void> {
  await seed(DUMMY.filter((e) => e.recurrence === "one-off"));
}

function randomAmount(): number {
  return Math.round((200 + Math.random() * 4800) * 100) / 100;
}

function randomStatus(): "paid" | "unpaid" {
  return Math.random() > 0.4 ? "paid" : "unpaid";
}

// Fake "paid on" timestamp for dummy history: a random day within that month,
// clamped to today for the current month (can't pay in the future). Dummy data only.
function randomPaidAt(year: number, month: number): string {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  const maxDay = isCurrent ? now.getDate() : 28;
  const day = 1 + Math.floor(Math.random() * maxDay);
  return new Date(year, month, day).toISOString();
}

export async function seedTestData(expenses: Expense[]): Promise<void> {
  const db = await getDB();
  const now = new Date();

  const months = [
    { year: now.getFullYear(), month: now.getMonth() },
    {
      year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() === 0 ? 11 : now.getMonth() - 1,
    },
    {
      year: now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() <= 1 ? now.getMonth() + 10 : now.getMonth() - 2,
    },
  ];

  for (const expense of expenses) {
    for (let i = 0; i < months.length; i++) {
      const { year, month } = months[i];
      const status = i === 0 ? randomStatus() : "paid";
      const amount = expense.isVariable ? randomAmount() : null;
      const paidAt = status === "paid" ? randomPaidAt(year, month) : null;
      await db.runAsync(
        `INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount, paid_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [expense.id, year, month, status, amount, paidAt]
      );
    }
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expense_months");
  await db.runAsync("DELETE FROM expenses");
  await db.runAsync("DELETE FROM categories WHERE id NOT LIKE 'preset-%'");
}

// oneOff=false clears every recurring row; oneOff=true clears one-off rows.
// Mirrors the seedRecurring/seedOneOff split. Also drops orphaned expense_months.
async function clearByRecurrence(oneOff: boolean): Promise<void> {
  const db = await getDB();
  const op = oneOff ? "=" : "!=";
  await db.runAsync(
    `DELETE FROM expense_months WHERE expense_id IN (SELECT id FROM expenses WHERE recurrence ${op} 'one-off')`
  );
  await db.runAsync(`DELETE FROM expenses WHERE recurrence ${op} 'one-off'`);
}

export async function clearRecurring(): Promise<void> {
  await clearByRecurrence(false);
}

export async function clearOneOff(): Promise<void> {
  await clearByRecurrence(true);
}
