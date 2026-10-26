import dayjs from "dayjs";
import type { Expense, Status } from "@/types";

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

export function nextOccurrence(day: number): Date {
  const thisMonth = getDueDate(day);
  if (!dayjs(thisMonth).isBefore(dayjs(), "day")) {
    return thisMonth;
  }
  const next = dayjs().add(1, "month");
  return getDueDateForMonth(day, next.year(), next.month());
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

// Relative inside the coming week ("Today", "Tomorrow", "in 4 days"), the date itself beyond it.
export function formatDueDate(d: Date): string {
  const diff = dayjs(d).startOf("day").diff(dayjs().startOf("day"), "day");
  if (diff === 0) {
    return "Today";
  }
  if (diff === 1) {
    return "Tomorrow";
  }
  if (diff > 1 && diff < 7) {
    return `in ${diff} days`;
  }
  return dayjs(d).format("MMM D");
}

export function formatDaysLate(d: Date): string {
  const days = dayjs().startOf("day").diff(dayjs(d).startOf("day"), "day");
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  let salutation: string;
  if (hour >= 5 && hour < 12) {
    salutation = "Good Morning";
  } else if (hour >= 12 && hour < 18) {
    salutation = "Good Afternoon";
  } else {
    salutation = "Good Evening";
  }
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
  if (endYear == null || endMonth == null) {
    return false;
  }
  return year > endYear || (year === endYear && month > endMonth);
}

export function formatMonth(year: number, month: number): string {
  return dayjs(new Date(year, month, 1)).format("MMM YYYY");
}

type CyclePlan = Pick<Expense, "recurrence" | "startYear" | "startMonth" | "endYear" | "endMonth">;

// "active": the plan has a cycle due this month. Otherwise it's before the start month, past the end month,
// or a yearly plan outside its anniversary month (the start month). One-offs are always active.
export type CycleState = "active" | "not-started" | "ended" | "off-cycle";

const monthIndex = (year: number, month: number) => year * 12 + month;

export function cycleStateOn(plan: CyclePlan, year: number, month: number): CycleState {
  if (plan.recurrence === "one-off") {
    return "active";
  }
  if (
    plan.startYear != null &&
    plan.startMonth != null &&
    monthIndex(year, month) < monthIndex(plan.startYear, plan.startMonth)
  ) {
    return "not-started";
  }
  if (isEndedOn(plan.endYear, plan.endMonth, year, month)) {
    return "ended";
  }
  if (plan.recurrence === "yearly" && plan.startMonth != null && month !== plan.startMonth) {
    return "off-cycle";
  }
  return "active";
}

// Whether a recurring expense is due in this month, so it counts in totals, lists and reminders.
export function hasCycleIn(plan: CyclePlan, year: number, month: number): boolean {
  return plan.recurrence !== "one-off" && cycleStateOn(plan, year, month) === "active";
}

// Due date of the plan's first cycle at or after the given month; null once no cycle is left.
export function nextCycleDueDate(plan: CyclePlan & Pick<Expense, "dueDay">, year: number, month: number): Date | null {
  for (let i = 0; i < 12; i++) {
    const at = dayjs(new Date(year, month + i, 1));
    const state = cycleStateOn(plan, at.year(), at.month());
    if (state === "active") {
      return getDueDateForMonth(plan.dueDay, at.year(), at.month());
    }
    if (state === "ended") {
      return null;
    }
    if (state === "not-started" && plan.startYear != null && plan.startMonth != null) {
      return getDueDateForMonth(plan.dueDay, plan.startYear, plan.startMonth);
    }
  }
  return null;
}

// Start month for a recurring expense saved before start months existed, recovered from its history so no
// recorded month disappears: the earliest of its created month and any month it has data for. Yearly plans
// anchor on their earliest paid month instead, since the month a yearly bill was paid is the month it's due.
export function inferStartMonth(a: {
  recurrence: Expense["recurrence"];
  createdAt: string;
  months: { year: number; month: number; status: Status }[];
}): { year: number; month: number } {
  const earliest = (list: { year: number; month: number }[]) =>
    list.reduce((first, m) => (monthIndex(m.year, m.month) < monthIndex(first.year, first.month) ? m : first));
  const paid = a.months.filter((m) => m.status === "paid");
  if (a.recurrence === "yearly" && paid.length > 0) {
    const { year, month } = earliest(paid);
    return { year, month };
  }
  const created = dayjs(a.createdAt);
  const { year, month } = earliest([{ year: created.year(), month: created.month() }, ...a.months]);
  return { year, month };
}
