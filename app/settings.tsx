import React, { useCallback, useState, useRef } from "react";
import { useMount } from "@/utils/useMount";
import { View, TouchableOpacity, Alert, AppState, Linking, Switch, ScrollView } from "react-native";
import * as Notifications from 'expo-notifications';
import dayjs from "dayjs";
import { getPreference, setPreference } from '@/db/preferences';
import { buildSummaryContent, getUnpaidBillReminders, requestPermissions } from '@/utils/notifications';
import { expenseTitle } from '@/utils/expenseHelpers';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { TimePickerSheet, type TimePickerSheetRef } from '@/components/TimePickerSheet';
import { exportBackup, formatImportSummary, importBackup } from "@/utils/backup";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { seedRecurring, seedOneOff, clearRecurring, clearOneOff, seedLoans, clearSeedLoans } from "@/db/seed";
import {
  PREF_LAST_BACKUP_AT,
  PREF_NOTIFICATIONS_ENABLED,
  PREF_NOTIFICATIONS_PERMISSION_ASKED,
  PREF_REMINDER_TIME,
} from "@/constants/preferences";
import { colors } from "@/constants/theme";

const version = Constants.expoConfig?.version ?? "—";

const IMPORT_NOTE = "Adds what's missing. Nothing here is overwritten.";

// What turning notifications on got from the system. "blocked" means an earlier firm no: it can't ask again, so
// only system Settings can allow them.
type PermissionAnswer = "granted" | "refused" | "blocked";

// "09:00" reads "9:00 AM", the same 12-hour form the picker uses.
function formatReminderTime(time: string): string {
  return dayjs(`2000-01-01T${time}`).format("h:mm A");
}

// Counts calendar days, so a backup made last night reads "yesterday" this morning.
function lastBackupCaption(lastBackupAt: string | null): string {
  if (lastBackupAt === null || !dayjs(lastBackupAt).isValid()) {
    return "Never backed up";
  }
  const days = dayjs().startOf("day").diff(dayjs(lastBackupAt).startOf("day"), "day");
  if (days <= 0) {
    return "Last backup today";
  }
  if (days === 1) {
    return "Last backup yesterday";
  }
  return `Last backup ${days} days ago`;
}

export default function SettingsScreen() {
  const { userName, reloadAll, expenses, rescheduleNotifications } = useExpenses();
  const accounts = useAccounts();
  const loans = useLoans();
  const unpaidItems = [
    ...expenses.filter((e) => e.status === 'unpaid').map((e) => ({ title: expenseTitle(e), amount: e.amount })),
    ...getUnpaidBillReminders(accounts.getCardBills, new Date()),
  ];
  const [importing, setImporting] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  // Set when the system prompt was just answered no, so the banner says why the switch went back off.
  const [wasRefused, setWasRefused] = useState(false);
  // Undefined until read, so the caption doesn't flash "Never backed up".
  const [lastBackupAt, setLastBackupAt] = useState<string | null>();
  const timeSheetRef = useRef<TimePickerSheetRef>(null);
  const isPermissionBannerShown = permissionStatus === 'denied' && (isNotificationsOn || wasRefused);
  const reminderTimeLabel = formatReminderTime(reminderTime);
  const lastBackupText = lastBackupAt === undefined ? null : lastBackupCaption(lastBackupAt);

  async function readPermission(): Promise<Notifications.PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
    return status;
  }

  // An import can restore these, so they are re-read after one as well as on mount.
  async function loadReminderPreferences() {
    const time = await getPreference(PREF_REMINDER_TIME);
    if (time) {
      setReminderTime(time);
    }
    const isEnabled = (await getPreference(PREF_NOTIFICATIONS_ENABLED)) !== 'false';
    // Nothing can remind before the system has been asked, so the switch reads off until turning it on asks.
    setIsNotificationsOn(isEnabled && (await readPermission()) !== 'undetermined');
  }

  useMount(async () => {
    await loadReminderPreferences();
    setLastBackupAt(await getPreference(PREF_LAST_BACKUP_AT));
  });

  // Returning from system Settings brings the app to the foreground without focusing this screen again, so the
  // permission behind the banner is re-checked on both.
  useFocusEffect(
    useCallback(() => {
      async function recheckPermission() {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
      }
      recheckPermission();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          recheckPermission();
        }
      });
      return () => subscription.remove();
    }, [])
  );

  async function handleTimeChange(val: string) {
    setReminderTime(val);
    await setPreference(PREF_REMINDER_TIME, val);
    rescheduleNotifications();
  }

  // Shows the system prompt while it still can (never asked, or Android's second chance).
  async function askForPermission(): Promise<PermissionAnswer> {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted') {
      return 'granted';
    }
    if (status !== 'undetermined' && !canAskAgain) {
      return 'blocked';
    }
    const isGranted = await requestPermissions();
    await setPreference(PREF_NOTIFICATIONS_PERMISSION_ASKED, 'true');
    await readPermission();
    return isGranted ? 'granted' : 'refused';
  }

  async function handleToggleNotifications(isOn: boolean) {
    setIsNotificationsOn(isOn);
    setWasRefused(false);
    // A no at the prompt keeps the switch off. When the system can't ask any more, the switch stays on and the
    // banner points to system Settings, so allowing them there is all it takes.
    const isRefused = isOn && (await askForPermission()) === 'refused';
    if (isRefused) {
      setIsNotificationsOn(false);
      setWasRefused(true);
    }
    await setPreference(PREF_NOTIFICATIONS_ENABLED, isOn && !isRefused ? 'true' : 'false');
    rescheduleNotifications();
  }

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Opening system Settings failed', error);
      Alert.alert("Couldn't open Settings", "Open your phone's Settings app and allow notifications for Recur.");
    }
  }

  const handleExport = async () => {
    try {
      await exportBackup();
      setLastBackupAt(await getPreference(PREF_LAST_BACKUP_AT));
    } catch (e: unknown) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "An error occurred.");
    }
  };

  const confirmClear = (label: string, fn: () => Promise<void>) => {
    Alert.alert(`Clear ${label}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await fn();
            await reloadAll();
            Alert.alert("Dev", `${label} cleared.`);
          } catch (e: unknown) {
            Alert.alert("Clear Failed", e instanceof Error ? e.message : "An error occurred.");
          }
        },
      },
    ]);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importBackup();
      if (result === null) {
        return;
      }
      await reloadAll();
      await accounts.reload();
      await loans.reload();
      await loadReminderPreferences();
      Alert.alert("Import complete", formatImportSummary(result));
    } catch (e: unknown) {
      Alert.alert("Import failed", e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title="Settings" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-2 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* PROFILE section */}
        <AppLabel className="pl-1">
          Profile
        </AppLabel>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={() => router.push("/settings/profile")}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="user" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Your name
            </AppText>
            <AppText variant="caption" className="text-textMuted mr-2">
              {userName ?? "Not set"}
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        </View>

        {/* APP section */}
        <AppLabel className="pl-1">
          App
        </AppLabel>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={() => router.push("/settings/category")}
            accessibilityRole="button"
            accessibilityLabel="Manage categories"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="grid" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Categories
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        </View>

        {/* DATA section */}
        <AppLabel className="pl-1">
          Data
        </AppLabel>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel={lastBackupText ? `Export data, ${lastBackupText}` : "Export data"}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="upload" size={15} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText variant="body-medium" className="text-white text-sm">
                Export data
              </AppText>
              {lastBackupText ? (
                <AppText variant="caption" className="mt-0.5">
                  {lastBackupText}
                </AppText>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
          <View className="h-px bg-white/[0.07]" />
          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={handleImport}
            accessibilityRole="button"
            accessibilityLabel="Import data"
            accessibilityHint={IMPORT_NOTE}
            accessibilityState={{ disabled: importing, busy: importing }}
            disabled={importing}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="download" size={15} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <AppText variant="body-medium" className="text-white text-sm">
                Import data
              </AppText>
              <AppText variant="caption" className="mt-0.5">
                {IMPORT_NOTE}
              </AppText>
            </View>
            {importing ? (
              <AppText variant="caption" className="text-textMuted mr-2">...</AppText>
            ) : (
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
            )}
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS section */}
        <AppLabel className="pl-1">
          Notifications
        </AppLabel>

        {isPermissionBannerShown && (
          <View
            className="rounded-xl px-4 pt-3 mb-3 border border-overdue bg-overdue/[0.08]"
          >
            <AppText variant="caption" className="text-overdue text-xs">
              Notifications are off for Recur. Turn them on in system Settings.
            </AppText>
            <TouchableOpacity
              className="min-h-[44px] justify-center self-start"
              onPress={handleOpenSettings}
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
            >
              <AppText variant="body-bold" className="text-overdue text-sm">
                Open Settings
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          {/* Enable/disable row */}
          <View className="flex-row items-center px-5 py-4">
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="bell" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Notifications
            </AppText>
            <Switch
              value={isNotificationsOn}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Notifications"
            />
          </View>
          <View className="h-px bg-white/[0.07]" />

          {/* Reminder time row: nothing to time while notifications are off */}
          <TouchableOpacity
            className={`flex-row items-center px-5 py-4 ${isNotificationsOn ? "" : "opacity-40"}`}
            onPress={() => timeSheetRef.current?.present()}
            disabled={!isNotificationsOn}
            accessibilityRole="button"
            accessibilityLabel={`Reminder time, ${reminderTimeLabel}`}
            accessibilityHint={isNotificationsOn ? undefined : "Turn on notifications to change it"}
            accessibilityState={{ disabled: !isNotificationsOn }}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
            >
              <Feather name="clock" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Reminder time
            </AppText>
            <AppText variant="caption" className="text-textMuted mr-2">
              {reminderTimeLabel}
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        </View>

        {/* ABOUT section */}
        <AppLabel className="pl-1">
          About
        </AppLabel>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <View className="flex-row items-center px-5 py-4">
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-secondary"
            >
              <Feather name="info" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Version
            </AppText>
            <AppText variant="caption" className="text-textMuted">
              {version}
            </AppText>
          </View>
        </View>

        {__DEV__ && (
          <>
            <AppLabel className="pl-1">
              Dev Tools
            </AppLabel>
            <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  await Notifications.cancelAllScheduledNotificationsAsync();
                  await Notifications.scheduleNotificationAsync({
                    content: buildSummaryContent(unpaidItems, 'soon'),
                    trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
                  });
                  Alert.alert('Dev', `Summary for ${unpaidItems.length} unpaid — firing in 5s`);
                }}
                accessibilityLabel="Test notifications"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-secondary"
                >
                  <Feather name="zap" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Fire notifications in 5s
                </AppText>
                <AppText variant="caption" className="text-textMuted">
                  {unpaidItems.length} unpaid
                </AppText>
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  try {
                    await seedRecurring();
                    await reloadAll();
                    Alert.alert('Dev', 'Recurring expenses seeded.');
                  } catch (e: unknown) {
                    Alert.alert('Seed Failed', e instanceof Error ? e.message : 'An error occurred.');
                  }
                }}
                accessibilityLabel="Seed recurring expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-paid"
                >
                  <Feather name="repeat" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed recurring
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  try {
                    await seedOneOff();
                    await reloadAll();
                    Alert.alert('Dev', 'One-off expenses seeded.');
                  } catch (e: unknown) {
                    Alert.alert('Seed Failed', e instanceof Error ? e.message : 'An error occurred.');
                  }
                }}
                accessibilityLabel="Seed one-off expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary"
                >
                  <Feather name="file-text" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed expenses
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={() => confirmClear('recurring', clearRecurring)}
                accessibilityLabel="Clear recurring expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-overdue"
                >
                  <Feather name="trash-2" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Clear recurring
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={() => confirmClear('expenses', clearOneOff)}
                accessibilityLabel="Clear one-off expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-overdue"
                >
                  <Feather name="trash-2" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Clear expenses
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  try {
                    await seedLoans();
                    await Promise.all([loans.reload(), accounts.reload()]);
                    Alert.alert('Dev', 'Sample loans seeded.');
                  } catch (e: unknown) {
                    Alert.alert('Seed Failed', e instanceof Error ? e.message : 'An error occurred.');
                  }
                }}
                accessibilityLabel="Seed sample loans"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-secondary"
                >
                  <Feather name="users" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed loans
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View className="h-px bg-white/[0.07]" />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={() =>
                  confirmClear('sample loans', async () => {
                    await clearSeedLoans();
                    await Promise.all([loans.reload(), accounts.reload()]);
                  })
                }
                accessibilityLabel="Clear sample loans"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-overdue"
                >
                  <Feather name="trash-2" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Clear sample loans
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>

      <TimePickerSheet
        ref={timeSheetRef}
        title="Reminder time"
        value={reminderTime}
        onChange={handleTimeChange}
      />
    </SafeAreaView>
  );
}
