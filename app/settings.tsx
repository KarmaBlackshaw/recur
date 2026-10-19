import React, { useState, useRef } from "react";
import useMount from "ahooks/es/useMount";
import { View, TouchableOpacity, Alert, Switch, ScrollView } from "react-native";
import * as Notifications from 'expo-notifications';
import { getPreference, setPreference } from '@/db/preferences';
import { buildSummaryContent, getUnpaidBillReminders } from '@/utils/notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { TimePickerSheet, type TimePickerSheetRef } from '@/components/TimePickerSheet';
import { exportBackup, importBackup } from "@/utils/backup";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { seedRecurring, seedOneOff, clearRecurring, clearOneOff } from "@/db/seed";
import { colors } from "@/constants/theme";

const version = Constants.expoConfig?.version ?? "—";

export default function SettingsScreen() {
  const { userName, reloadAll, expenses, rescheduleNotifications } = useExpenses();
  const accounts = useAccounts();
  const unpaidItems = [
    ...expenses.filter((e) => e.status === 'unpaid'),
    ...getUnpaidBillReminders(accounts.getCardBills, new Date()),
  ];
  const [importing, setImporting] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const timeSheetRef = useRef<TimePickerSheetRef>(null);

  useMount(async () => {
    const time = await getPreference('reminderTime');
    if (time) {
      setReminderTime(time);
    }
    const enabled = await getPreference('notificationsEnabled');
    if (enabled === 'false') {
      setNotificationsEnabled(false);
    }
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionDenied(status !== 'granted');
  });

  async function handleTimeChange(val: string) {
    setReminderTime(val);
    await setPreference('reminderTime', val);
    rescheduleNotifications();
  }

  async function handleToggleNotifications(val: boolean) {
    setNotificationsEnabled(val);
    await setPreference('notificationsEnabled', val ? 'true' : 'false');
    rescheduleNotifications();
  }

  const handleExport = async () => {
    try {
      await exportBackup();
    } catch (e: unknown) {
      Alert.alert("Export Failed", e instanceof Error ? e.message : "An error occurred.");
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
      Alert.alert("Import Complete", `${result.added} added, ${result.skipped} skipped (already exist).`);
    } catch (e: unknown) {
      Alert.alert("Import Failed", e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity
          className="w-11 h-11 items-center justify-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Settings
        </AppText>
        <View style={{ width: 32 }} />
      </View>

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
            accessibilityLabel="Edit profile"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Feather name="user" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Your Name
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
            accessibilityLabel="Manage categories"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
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
            accessibilityLabel="Export data"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Feather name="upload" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Export Data
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={handleImport}
            accessibilityLabel="Import data"
            disabled={importing}
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Feather name="download" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Import Data
            </AppText>
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

        {permissionDenied && notificationsEnabled && (
          <View
            className="rounded-xl px-4 py-3 mb-3 border border-overdue"
            style={{ backgroundColor: 'rgba(248,113,113,0.08)' }}
          >
            <AppText variant="caption" className="text-overdue text-xs">
              Notifications disabled — enable in system Settings
            </AppText>
          </View>
        )}

        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          {/* Reminder time row */}
          <TouchableOpacity
            className="flex-row items-center px-5 py-4 border-b border-border"
            onPress={() => timeSheetRef.current?.present()}
            accessibilityLabel="Set reminder time"
          >
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Feather name="bell" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Reminder time
            </AppText>
            <AppText variant="caption" className="text-textMuted mr-2">
              {reminderTime}
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>

          {/* Enable/disable row */}
          <View className="flex-row items-center px-5 py-4">
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Feather name="bell" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">
              Notifications
            </AppText>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ABOUT section */}
        <AppLabel className="pl-1">
          About
        </AppLabel>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <View className="flex-row items-center px-5 py-4">
            <View
              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: colors.secondary }}
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
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
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
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: colors.paid }}
                >
                  <Feather name="repeat" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed recurring
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
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
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Feather name="file-text" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed expenses
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={() => confirmClear('recurring', clearRecurring)}
                accessibilityLabel="Clear recurring expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: colors.overdue }}
                >
                  <Feather name="trash-2" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Clear recurring
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={() => confirmClear('expenses', clearOneOff)}
                accessibilityLabel="Clear one-off expenses"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: colors.overdue }}
                >
                  <Feather name="trash-2" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Clear expenses
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>

      <TimePickerSheet
        ref={timeSheetRef}
        title="Reminder Time"
        value={reminderTime}
        onChange={handleTimeChange}
      />
    </SafeAreaView>
  );
}
