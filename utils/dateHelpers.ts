import {
  isPast,
  startOfDay,
  addWeeks,
  addMonths,
  addYears,
  isToday,
  isTomorrow,
  differenceInCalendarDays,
  format,
} from "date-fns";
import type { Recurrence } from "../types";

export function isOverdue(dueDate: string): boolean {
  const d = startOfDay(new Date(dueDate));
  return isPast(d) && !isToday(new Date(dueDate));
}

export function nextDueDate(dueDate: string, recurrence: Recurrence): string {
  const d = new Date(dueDate);
  let next: Date;
  switch (recurrence) {
    case "weekly":
      next = addWeeks(d, 1);
      break;
    case "monthly":
      next = addMonths(d, 1);
      break;
    case "yearly":
      next = addYears(d, 1);
      break;
    default:
      return dueDate;
  }
  return format(next, "yyyy-MM-dd");
}

export function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff <= 6) return `${diff} days`;
  return format(d, "MMM d");
}
