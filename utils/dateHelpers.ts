import dayjs from "dayjs";
import type { Recurrence } from "../types";

export function getDueDate(dueDay: number): Date {
  const now = new Date();
  const maxDay = dayjs(now).daysInMonth();
  const clampedDay = Math.min(dueDay, maxDay);
  return new Date(now.getFullYear(), now.getMonth(), clampedDay);
}

export function getDueDateForMonth(
  dueDay: number,
  year: number,
  month: number  // 0-indexed, e.g. January = 0
): Date {
  const maxDay = dayjs(new Date(year, month)).daysInMonth();
  const clampedDay = Math.min(dueDay, maxDay);
  return new Date(year, month, clampedDay);
}

// The date a paid recurring cycle "counts" on: the real pay timestamp when one
// was recorded, else the cycle's due date (legacy rows saved before paid_at).
// Advance payments therefore land in the calendar month they were paid, not the
// cycle's due month.
export function effectivePaidDate(
  paidAt: string | null | undefined,
  dueDay: number,
  dueYear: number,
  dueMonth: number
): Date {
  return paidAt ? dayjs(paidAt).toDate() : getDueDateForMonth(dueDay, dueYear, dueMonth);
}

export function isOverdue(dueDay: number): boolean {
  const d = dayjs(getDueDate(dueDay)).startOf("day");
  return d.isBefore(dayjs()) && !d.isSame(dayjs(), "day");
}

export function nextDueDay(dueDay: number, recurrence: Recurrence): number {
  // dueDay is a fixed anchor (1–31) — it never changes between cycles.
  return dueDay;
}

export function formatDue(dueDay: number): string {
  return formatDueDate(getDueDate(dueDay));
}

export function formatDueDate(d: Date): string {
  if (dayjs(d).isSame(dayjs(), "day")) return "Today";
  if (dayjs(d).isSame(dayjs().add(1, "day"), "day")) return "Tomorrow";
  const diff = dayjs(d).startOf("day").diff(dayjs().startOf("day"), "day");
  if (diff > 0) return `${diff} days`;
  return dayjs(d).format("MMM D");
}

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  let salutation: string;
  if (hour >= 5 && hour < 12) salutation = "Good Morning";
  else if (hour >= 12 && hour < 18) salutation = "Good Afternoon";
  else salutation = "Good Evening";
  return name ? `${salutation}, ${name}` : salutation;
}

export function getFormattedDate(): string {
  return dayjs().format("dddd, MMM D");
}

export function formatAmount(amount: number): string {
  return "₱" + amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isOverdueOn(dueDay: number, year: number, month: number): boolean {
  const d = dayjs(getDueDateForMonth(dueDay, year, month)).startOf("day");
  return d.isBefore(dayjs()) && !d.isSame(dayjs(), "day");
}

export function isEndedOn(
  endYear: number | null | undefined,
  endMonth: number | null | undefined,
  year: number,
  month: number
): boolean {
  if (endYear == null || endMonth == null) return false;
  return year > endYear || (year === endYear && month > endMonth);
}

export function formatEndMonth(endYear: number, endMonth: number): string {
  return dayjs(new Date(endYear, endMonth, 1)).format("MMM YYYY");
}
