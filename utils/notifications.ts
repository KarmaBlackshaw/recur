import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import dayjs from 'dayjs';
import { getDueDate, isEndedOn } from './dateHelpers';
import type { Expense } from '../types';

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function pesoTotal(group: Expense[]): string | undefined {
  const withAmount = group.filter((e) => e.amount != null);
  if (withAmount.length === 0) return undefined;
  const total = withAmount.reduce((sum, e) => sum + (e.amount as number), 0);
  return '₱' + total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' total';
}

function dueLabel(daysBefore: number): string {
  if (daysBefore <= 0) return 'today';
  if (daysBefore === 1) return 'tomorrow';
  return `in ${daysBefore} days`;
}

// Grouped summary content for a set of expenses that all fire together.
// `label` is the caller-computed "due …" phrase (dev test passes 'soon').
export function buildSummaryContent(group: Expense[], label: string): { title: string; body?: string } {
  const count = group.length;
  return {
    title: `${count} payment${count === 1 ? '' : 's'} due ${label}`,
    body: pesoTotal(group),
  };
}

export async function scheduleAllNotifications(
  expenses: Expense[],
  reminderTime: string
): Promise<void> {
  try {
    await cancelAllNotifications();
    const [hoursStr, minutesStr] = reminderTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const now = new Date();

    // Group eligible expenses by the exact moment they'd fire.
    const groups = new Map<number, { expenses: Expense[]; leads: Set<number> }>();

    for (const expense of expenses) {
      if (expense.status !== 'unpaid') continue;
      if (expense.reminderDaysBefore === 0) continue;

      const daysBefore = expense.reminderDaysBefore ?? 1;
      const dueDate = getDueDate(expense.dueDay);
      if (isEndedOn(expense.endYear, expense.endMonth, dueDate.getFullYear(), dueDate.getMonth())) continue;
      const fireDate = dayjs(dueDate).subtract(daysBefore, 'day').hour(hours).minute(minutes).toDate();

      if (dayjs(fireDate).isBefore(now)) continue;

      const key = fireDate.getTime();
      const group = groups.get(key) ?? { expenses: [], leads: new Set<number>() };
      group.expenses.push(expense);
      group.leads.add(daysBefore);
      groups.set(key, group);
    }

    for (const [fireTime, group] of groups) {
      const label = group.leads.size === 1 ? dueLabel([...group.leads][0]) : 'soon';
      await Notifications.scheduleNotificationAsync({
        content: buildSummaryContent(group.expenses, label),
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(fireTime) },
      });
    }
  } catch (err) {
    console.error('[notifications] scheduleAllNotifications error:', err);
  }
}
