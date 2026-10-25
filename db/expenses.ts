import dayjs from "dayjs";
import { getDB } from "@/db/schema";
import { touchCategory } from "@/db/categories";
import { newId } from "@/db/accountTransactions";
import type { Expense, Status } from "@/types";

const COLUMNS =
  "id, name, category, amount, dueDay, recurrence, status, is_variable, reminder_days_before, notes, createdAt, paid_date, start_year, start_month, end_year, end_month, account_id";

type ExpenseFields = Omit<Expense, "id" | "createdAt">;

// One-offs have no schedule. A new recurring plan without a start month starts in the month it's created.
function scheduleOf(e: ExpenseFields, createdAt?: string) {
  if (e.recurrence === "one-off") {
    return { startYear: null, startMonth: null, endYear: null, endMonth: null };
  }
  const hasStart = e.startYear != null && e.startMonth != null;
  const created = createdAt != null && !hasStart ? dayjs(createdAt) : null;
  return {
    startYear: created ? created.year() : e.startYear ?? null,
    startMonth: created ? created.month() : e.startMonth ?? null,
    endYear: e.endYear ?? null,
    endMonth: e.endMonth ?? null,
  };
}

export async function getAll(): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: string; name: string; category: string; amount: number | null;
    dueDay: number; recurrence: string; status: string; is_variable: number;
    reminder_days_before: number | null; notes: string | null; createdAt: string;
    paid_date: string | null; start_year: number | null; start_month: number | null;
    end_year: number | null; end_month: number | null; account_id: string | null;
  }>(`SELECT ${COLUMNS} FROM expenses ORDER BY dueDay ASC`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: r.amount,
    dueDay: r.dueDay,
    recurrence: r.recurrence as Expense["recurrence"],
    status: r.status as Status,
    isVariable: r.is_variable === 1,
    reminderDaysBefore: r.reminder_days_before ?? null,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt,
    paidDate: r.paid_date ?? null,
    startYear: r.start_year ?? null,
    startMonth: r.start_month ?? null,
    endYear: r.end_year ?? null,
    endMonth: r.end_month ?? null,
    accountId: r.account_id ?? null,
  }));
}

export async function insert(e: ExpenseFields): Promise<Expense> {
  const db = await getDB();
  const id = newId();
  const createdAt = new Date().toISOString();
  // Regular (one-off) expenses represent money already spent → auto-paid.
  const status: Status = e.recurrence === "one-off" ? "paid" : (e.status ?? "unpaid");
  // One-offs carry a paid date (defaults to today); recurring never do.
  const paidDate: string | null =
    e.recurrence === "one-off" ? (e.paidDate ?? createdAt) : null;
  const schedule = scheduleOf(e, createdAt);
  await db.runAsync(
    `INSERT INTO expenses (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.name, e.category, e.amount, e.dueDay, e.recurrence, status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, createdAt, paidDate, schedule.startYear, schedule.startMonth, schedule.endYear, schedule.endMonth, e.accountId ?? null]
  );
  await touchCategory(e.category, createdAt);
  return { ...e, id, createdAt, status, paidDate, ...schedule, accountId: e.accountId ?? null };
}

export async function insertWithId(e: Expense): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR IGNORE INTO expenses (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.createdAt, e.paidDate ?? null, e.startYear ?? null, e.startMonth ?? null, e.endYear ?? null, e.endMonth ?? null, e.accountId ?? null]
  );
  await touchCategory(e.category, e.createdAt);
}

export async function updateStatus(
  id: string,
  status: Status
): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE expenses SET status = ? WHERE id = ?", [status, id]);
}

export async function update(id: string, e: ExpenseFields): Promise<void> {
  const db = await getDB();
  const schedule = scheduleOf(e);
  await db.runAsync(
    `UPDATE expenses SET name=?, category=?, amount=?, dueDay=?, recurrence=?, status=?, is_variable=?, reminder_days_before=?, notes=?, paid_date=?, start_year=?, start_month=?, end_year=?, end_month=?, account_id=? WHERE id=?`,
    [e.name, e.category, e.amount, e.dueDay, e.recurrence, e.status, e.isVariable ? 1 : 0, e.reminderDaysBefore ?? null, e.notes ?? null, e.recurrence === "one-off" ? (e.paidDate ?? null) : null, schedule.startYear, schedule.startMonth, schedule.endYear, schedule.endMonth, e.accountId ?? null, id]
  );
  await touchCategory(e.category);
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", [id]);
}
