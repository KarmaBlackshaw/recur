import { getDB } from "./schema";
import type { Expense } from "../types";

function randomAmount(): number {
  return Math.round((200 + Math.random() * 4800) * 100) / 100;
}

function randomStatus(): "paid" | "unpaid" {
  return Math.random() > 0.4 ? "paid" : "unpaid";
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
      await db.runAsync(
        `INSERT OR REPLACE INTO expense_months (expense_id, year, month, status, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [expense.id, year, month, status, amount]
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
