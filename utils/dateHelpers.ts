import {
  isPast,
  startOfDay,
  isToday,
  isTomorrow,
  differenceInCalendarDays,
  getDaysInMonth,
  format,
} from "date-fns";
import type { Recurrence } from "../types";

export function getDueDate(dueDay: number): Date {
  const now = new Date();
  const maxDay = getDaysInMonth(now);
  const clampedDay = Math.min(dueDay, maxDay);
  return new Date(now.getFullYear(), now.getMonth(), clampedDay);
}

export function isOverdue(dueDay: number): boolean {
  const d = startOfDay(getDueDate(dueDay));
  return isPast(d) && !isToday(d);
}

export function nextDueDay(dueDay: number, recurrence: Recurrence): number {
  // dueDay is a fixed anchor (1–31) — it never changes between cycles.
  return dueDay;
}

export function formatDue(dueDay: number): string {
  const d = getDueDate(dueDay);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0) return `${diff} days`;
  return format(d, "MMM d");
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
  return format(new Date(), "EEEE, MMM d").toUpperCase();
}
