import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { subDays, setHours, setMinutes, isBefore } from 'date-fns';
import { getDueDate } from './dateHelpers';
import type { Expense } from '../types';

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
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

    for (const expense of expenses) {
      if (expense.status !== 'unpaid') continue;
      if (expense.reminderDaysBefore === 0) continue;

      const daysBefore = expense.reminderDaysBefore ?? 1;
      const dueDate = getDueDate(expense.dueDay);
      let fireDate = subDays(dueDate, daysBefore);
      fireDate = setHours(fireDate, hours);
      fireDate = setMinutes(fireDate, minutes);

      if (isBefore(fireDate, now)) continue;

      const bodyAmount =
        expense.amount != null
          ? '₱' + expense.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : 'TBD';

      await Notifications.scheduleNotificationAsync({
        content: { title: expense.name, body: bodyAmount },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: fireDate },
      });
    }
  } catch (err) {
    console.error('[notifications] scheduleAllNotifications error:', err);
  }
}
