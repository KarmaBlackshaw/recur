import dayjs from "dayjs";
import { groupBy, sortBy, uniq } from "@/utils/collections";
import type { Account, Expense, TOption } from "@/types";

// Every unpaid bill reminds on its due day. These pick an earlier reminder too, in days before the due date,
// shared by bills and credit cards: "0" adds none; a stored null (an empty form value) is the default, a day before.
export const REMINDER_OPTIONS: TOption<string>[] = [
  { label: "On the day", value: "0" },
  { label: "1 day", value: "1" },
  { label: "2 days", value: "2" },
  { label: "3 days", value: "3" },
  { label: "1 week", value: "7" },
];
export const DEFAULT_REMINDER = "1";

// A lead time the chips don't offer (the old typed field took 1–14 days) stays pickable as its own chip.
export function reminderOptionsFor(stored: number | null | undefined): TOption<string>[] {
  if (stored == null || stored < 1 || REMINDER_OPTIONS.some((option) => option.value === String(stored))) {
    return REMINDER_OPTIONS;
  }
  return [...REMINDER_OPTIONS, { label: `${stored} days`, value: String(stored) }].sort(
    (a, b) => Number(a.value) - Number(b.value)
  );
}

export function toReminderFormValue(stored: number | null | undefined): string {
  return stored != null ? String(stored) : "";
}

export function parseReminder(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : parseInt(trimmed, 10);
}

// Days before the due date the earlier reminder fires, or null when there's none (only the due day's).
export function reminderLead(stored: number | null | undefined): number | null {
  return stored === 0 ? null : stored ?? 1;
}

// A bill charged to a card is due with the card bill, so it reminds when the card does.
export function billReminderLead(
  expense: Pick<Expense, "reminderDaysBefore">,
  card: Pick<Account, "reminderDaysBefore"> | undefined
): number | null {
  return reminderLead(card ? card.reminderDaysBefore : expense.reminderDaysBefore);
}

export function reminderLabel(stored: number | null | undefined): string {
  const days = reminderLead(stored);
  if (days == null) {
    return "On the due day";
  }
  return `${days} ${days === 1 ? "day" : "days"} before and on the day`;
}

export interface ReminderFire<R> {
  fireAt: Date;
  daysBefore: number;
  reminders: R[];
}

// Each bill fires on its due day, and its lead time (`daysBefore`, null for none) adds a fire that many days
// earlier. Bills firing at the same time with the same lead share one notification ("A and B due tomorrow").
// Fire times already past are dropped, and only the soonest `limit` notifications are kept.
export function planReminders<R extends { dueDate: Date; daysBefore: number | null }>(
  reminders: R[],
  reminderTime: string,
  now: Date,
  limit: number
): ReminderFire<R>[] {
  const [hours, minutes] = reminderTime.split(":").map((part) => parseInt(part, 10));
  const fires = reminders
    .flatMap((reminder) =>
      uniq([reminder.daysBefore ?? 0, 0]).map((daysBefore) => ({
        reminder,
        daysBefore,
        fireAt: dayjs(reminder.dueDate).subtract(daysBefore, "day").hour(hours).minute(minutes).toDate(),
      }))
    )
    .filter((fire) => !dayjs(fire.fireAt).isBefore(now));
  const groups = Object.values(groupBy(fires, (fire) => `${fire.fireAt.getTime()}:${fire.daysBefore}`));
  return sortBy(groups, [(group) => group[0].fireAt.getTime(), (group) => group[0].daysBefore])
    .slice(0, limit)
    .map((group) => ({
      fireAt: group[0].fireAt,
      daysBefore: group[0].daysBefore,
      reminders: group.map((fire) => fire.reminder),
    }));
}
