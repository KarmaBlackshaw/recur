import type { Account, Expense, TOption } from "@/types";

// Days before the due date, shared by bills and credit cards. "0" turns the reminder off; a stored null
// (an empty form value) is the default, a day before.
export const REMINDER_OPTIONS: TOption<string>[] = [
  { label: "Off", value: "0" },
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

// Days before the due date a reminder fires, or null when it's off.
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
    return "Off";
  }
  return `${days} ${days === 1 ? "day" : "days"} before`;
}
