import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import dayjs from 'dayjs';
import { groupBy, range, sortBy, sumBy, uniq } from '@/utils/collections';
import { getDueDateForMonth, hasCycleIn } from '@/utils/dateHelpers';
import { expenseTitle } from '@/utils/expenseHelpers';
import type { CardBill, Expense, Status } from '@/types';

// The bill a reminder is about, so tapping it (or its Mark paid action) can open that bill.
export interface ReminderTarget {
  expenseId: string;
  year: number;
  month: number;
}

export interface Reminder {
  title: string;
  amount: number | null;
  dueDate: Date;
  daysBefore: number;
  target?: ReminderTarget;
}

// Single-bill reminders carry a "Mark paid" action that opens the bill's Pay sheet.
export const BILL_DUE_CATEGORY = 'bill-due';
export const MARK_PAID_ACTION = 'mark-paid';

// Reminders are scheduled a year ahead so they keep arriving even when the app isn't opened for a while;
// every launch reschedules them with current amounts.
const REMINDER_MONTHS_AHEAD = 12;
// iOS keeps at most 64 pending local notifications per app, so only the soonest ones are scheduled.
const MAX_SCHEDULED = 60;

function upcomingMonths(now: Date): dayjs.Dayjs[] {
  const start = dayjs(now).startOf('month');
  return range(REMINDER_MONTHS_AHEAD).map((i) => start.add(i, 'month'));
}

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(BILL_DUE_CATEGORY, [
    { identifier: MARK_PAID_ACTION, buttonTitle: 'Mark paid', options: { opensAppToForeground: true } },
  ]);
}

function peso(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dueLabel(daysBefore: number): string {
  if (daysBefore <= 0) {
    return 'today';
  }
  if (daysBefore === 1) {
    return 'tomorrow';
  }
  return `in ${daysBefore} days`;
}

// "Netflix", "Netflix and Spotify", "Netflix, Spotify and 2 more".
function namesOf(titles: string[]): string {
  if (titles.length <= 2) {
    return titles.join(' and ');
  }
  return `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
}

// Content for a set of bills that all fire together. `label` is the "due …" phrase (dev test passes 'soon').
export function buildSummaryContent(
  group: { title: string; amount: number | null }[],
  label: string
): { title: string; body?: string } {
  const withAmount = group.filter((r) => r.amount != null);
  const total = sumBy(withAmount, (r) => r.amount ?? 0);
  if (group.length === 1) {
    return { title: `${group[0].title} due ${label}`, body: withAmount.length ? peso(total) : undefined };
  }
  return {
    title: `${namesOf(group.map((r) => r.title))} due ${label}`,
    body: withAmount.length ? `${peso(total)} total` : undefined,
  };
}

export function getExpenseReminders(
  expenses: Expense[],
  getMonthStatus: (id: string, year: number, month: number) => Status,
  getDisplayAmount: (expense: Expense, year: number, month: number) => number | null,
  now: Date
): Reminder[] {
  const months = upcomingMonths(now);
  const reminders: Reminder[] = [];
  for (const expense of expenses) {
    // 0 days before means the reminder is off for this bill.
    if (expense.reminderDaysBefore === 0) {
      continue;
    }
    const daysBefore = expense.reminderDaysBefore ?? 1;
    const isOneOff = expense.recurrence === 'one-off';
    const cycles = isOneOff ? [months[0]] : months;
    for (const cycle of cycles) {
      const year = cycle.year();
      const month = cycle.month();
      if (!isOneOff && !hasCycleIn(expense, year, month)) {
        continue;
      }
      if (getMonthStatus(expense.id, year, month) !== 'unpaid') {
        continue;
      }
      reminders.push({
        title: expenseTitle(expense),
        amount: getDisplayAmount(expense, year, month),
        dueDate: getDueDateForMonth(expense.dueDay, year, month),
        daysBefore,
        target: isOneOff ? undefined : { expenseId: expense.id, year, month },
      });
    }
  }
  return reminders;
}

export function getUnpaidBillReminders(
  getCardBills: (year: number, month: number) => CardBill[],
  now: Date
): Reminder[] {
  // Statements not cut yet are estimated from the card's balance as of now.
  return upcomingMonths(now)
    .flatMap((month) => getCardBills(month.year(), month.month()))
    .filter((bill) => !bill.isPaid && bill.remaining > 0)
    .map((bill) => ({ title: `${bill.account.name} bill`, amount: bill.remaining, dueDate: bill.dueDate, daysBefore: 1 }));
}

export async function scheduleAllNotifications(reminders: Reminder[], reminderTime: string): Promise<void> {
  try {
    await cancelAllNotifications();
    const [hoursStr, minutesStr] = reminderTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const now = new Date();

    const eligible: { reminder: Reminder; fireTime: number }[] = [];
    for (const reminder of reminders) {
      const fireDate = dayjs(reminder.dueDate).subtract(reminder.daysBefore, 'day').hour(hours).minute(minutes).toDate();
      if (dayjs(fireDate).isBefore(now)) {
        continue;
      }
      eligible.push({ reminder, fireTime: fireDate.getTime() });
    }

    const soonest = sortBy(Object.entries(groupBy(eligible, 'fireTime')), ([fireTime]) => Number(fireTime)).slice(
      0,
      MAX_SCHEDULED
    );
    for (const [fireTime, group] of soonest) {
      const leads = uniq(group.map((g) => g.reminder.daysBefore));
      const label = leads.length === 1 ? dueLabel(leads[0]) : 'soon';
      const single = group.length === 1 ? group[0].reminder : null;
      await Notifications.scheduleNotificationAsync({
        content: {
          ...buildSummaryContent(group.map((g) => g.reminder), label),
          data: single?.target ? { ...single.target } : {},
          categoryIdentifier: single?.target ? BILL_DUE_CATEGORY : undefined,
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(Number(fireTime)) },
      });
    }
  } catch (err) {
    console.error('[notifications] scheduleAllNotifications error:', err);
  }
}
