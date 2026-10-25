import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import dayjs from 'dayjs';
import groupBy from 'lodash/groupBy';
import sumBy from 'lodash/sumBy';
import uniq from 'lodash/uniq';
import { getDueDateForMonth, hasCycleIn } from '@/utils/dateHelpers';
import type { CardBill, Expense, Status } from '@/types';

export interface Reminder {
  amount: number | null;
  dueDate: Date;
  daysBefore: number;
}

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function pesoTotal(group: { amount: number | null }[]): string | undefined {
  const withAmount = group.filter((e) => e.amount != null);
  if (withAmount.length === 0) {
    return undefined;
  }
  const total = sumBy(withAmount, 'amount');
  return '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' total';
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

// Grouped summary content for a set of expenses that all fire together.
// `label` is the caller-computed "due …" phrase (dev test passes 'soon').
export function buildSummaryContent(group: { amount: number | null }[], label: string): { title: string; body?: string } {
  const count = group.length;
  return {
    title: `${count} payment${count === 1 ? '' : 's'} due ${label}`,
    body: pesoTotal(group),
  };
}

export function getExpenseReminders(
  expenses: Expense[],
  getMonthStatus: (id: string, year: number, month: number) => Status,
  getDisplayAmount: (expense: Expense, year: number, month: number) => number | null,
  now: Date
): Reminder[] {
  const current = dayjs(now);
  const next = current.add(1, 'month');
  const reminders: Reminder[] = [];
  for (const expense of expenses) {
    if (expense.reminderDaysBefore === 0) {
      continue;
    }
    const daysBefore = expense.reminderDaysBefore ?? 1;
    const cycles = expense.recurrence === 'one-off' ? [current] : [current, next];
    for (const cycle of cycles) {
      const year = cycle.year();
      const month = cycle.month();
      if (expense.recurrence !== 'one-off' && !hasCycleIn(expense, year, month)) {
        continue;
      }
      if (getMonthStatus(expense.id, year, month) !== 'unpaid') {
        continue;
      }
      reminders.push({
        amount: getDisplayAmount(expense, year, month),
        dueDate: getDueDateForMonth(expense.dueDay, year, month),
        daysBefore,
      });
    }
  }
  return reminders;
}

export function getUnpaidBillReminders(
  getCardBills: (year: number, month: number) => CardBill[],
  now: Date
): Reminder[] {
  const current = dayjs(now);
  const next = current.add(1, 'month');
  return [
    ...getCardBills(current.year(), current.month()),
    ...getCardBills(next.year(), next.month()),
  ]
    .filter((bill) => !bill.isPaid && bill.remaining > 0)
    .map((bill) => ({ amount: bill.remaining, dueDate: bill.dueDate, daysBefore: 1 }));
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

    for (const [fireTime, group] of Object.entries(groupBy(eligible, 'fireTime'))) {
      const leads = uniq(group.map((g) => g.reminder.daysBefore));
      const label = leads.length === 1 ? dueLabel(leads[0]) : 'soon';
      await Notifications.scheduleNotificationAsync({
        content: buildSummaryContent(group.map((g) => g.reminder), label),
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(Number(fireTime)) },
      });
    }
  } catch (err) {
    console.error('[notifications] scheduleAllNotifications error:', err);
  }
}
