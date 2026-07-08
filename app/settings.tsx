import React, { useState, useEffect, useRef } from "react";
import { View, TouchableOpacity, Alert, Switch } from "react-native";
import * as Notifications from 'expo-notifications';
import { getPreference, setPreference } from '../db/preferences';
import { scheduleAllNotifications, cancelAllNotifications } from '../utils/notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { AppSelectBottomSheet, type AppSelectBottomSheetRef } from '../components/ui/AppSelectBottomSheet';
import { exportBackup, importBackup } from "../utils/backup";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { AppText } from "../components/ui/AppText";
import { useExpenses } from "../context/ExpenseContext";
import { seedDummyData } from "../db/seed";
import { expenseTitle } from "../utils/expenseHelpers";
import { colors } from "../constants/theme";

const version = Constants.expoConfig?.version ?? "—";

const TIME_OPTIONS = (() => {
  const opts: { label: string; value: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      opts.push({ label: `${hh}:${mm}`, value: `${hh}:${mm}` });
    }
  }
  return opts;
})();

export default function SettingsScreen() {
  const { userName, reloadAll, expenses } = useExpenses();
  const [importing, setImporting] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const timeSheetRef = useRef<AppSelectBottomSheetRef>(null);

  useEffect(() => {
    (async () => {
      const time = await getPreference('reminderTime');
      if (time) setReminderTime(time);
      const enabled = await getPreference('notificationsEnabled');
      if (enabled === 'false') setNotificationsEnabled(false);
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionDenied(status !== 'granted');
    })();
  }, []);

  async function handleTimeChange(val: string) {
    setReminderTime(val);
    await setPreference('reminderTime', val);
    const enabled = await getPreference('notificationsEnabled');
    if (enabled !== 'false') await scheduleAllNotifications(expenses, val);
  }

  async function handleToggleNotifications(val: boolean) {
    setNotificationsEnabled(val);
    await setPreference('notificationsEnabled', val ? 'true' : 'false');
    if (val) {
      const time = await getPreference('reminderTime') ?? '09:00';
      await scheduleAllNotifications(expenses, time);
    } else {
      await cancelAllNotifications();
    }
  }

  const handleExport = async () => {
    try {
      await exportBackup();
    } catch (e: unknown) {
      Alert.alert("Export Failed", e instanceof Error ? e.message : "An error occurred.");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importBackup();
      if (result === null) return;
      await reloadAll();
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
        <TouchableOpacity className="p-1" onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Settings
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <View className="px-4 pt-2">
        {/* PROFILE section */}
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          Profile
        </AppText>
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
            <AppText variant="caption" className="text-white/35 mr-2">
              {userName ?? "Not set"}
            </AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        </View>

        {/* APP section */}
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          App
        </AppText>
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
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          Data
        </AppText>
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
              <AppText variant="caption" className="text-white/35 mr-2">...</AppText>
            ) : (
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
            )}
          </TouchableOpacity>
        </View>

        {/* NOTIFICATIONS section */}
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          Notifications
        </AppText>

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
            <AppText variant="caption" className="text-white/35 mr-2">
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
        <AppText variant="label" className="text-white/40 mb-2 pl-1">
          About
        </AppText>
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
            <AppText variant="caption" className="text-white/35">
              {version}
            </AppText>
          </View>
        </View>

        {__DEV__ && (
          <>
            <AppText variant="label" className="text-white/40 mb-2 pl-1">
              Dev Tools
            </AppText>
            <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  await Notifications.cancelAllScheduledNotificationsAsync();
                  for (const expense of expenses) {
                    if (expense.status !== 'unpaid') continue;
                    await Notifications.scheduleNotificationAsync({
                      content: {
                        title: expenseTitle(expense),
                        body: expense.amount != null
                          ? '₱' + expense.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : 'TBD',
                      },
                      trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
                    });
                  }
                  Alert.alert('Dev', `Scheduled ${expenses.filter(e => e.status === 'unpaid').length} notification(s) — firing in 5s`);
                }}
                accessibilityLabel="Test notifications"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: '#F59E0B' }}
                >
                  <Feather name="zap" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Fire notifications in 5s
                </AppText>
                <AppText variant="caption" className="text-white/35">
                  {expenses.filter(e => e.status === 'unpaid').length} unpaid
                </AppText>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              <TouchableOpacity
                className="flex-row items-center px-5 py-4"
                onPress={async () => {
                  try {
                    await seedDummyData();
                    await reloadAll();
                    Alert.alert('Dev', 'Dummy data seeded.');
                  } catch (e: unknown) {
                    Alert.alert('Seed Failed', e instanceof Error ? e.message : 'An error occurred.');
                  }
                }}
                accessibilityLabel="Seed dummy data"
              >
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: colors.paid }}
                >
                  <Feather name="database" size={15} color="#FFFFFF" />
                </View>
                <AppText variant="body-medium" className="flex-1 text-white text-sm">
                  Seed dummy data
                </AppText>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>

      <AppSelectBottomSheet
        ref={timeSheetRef}
        title="Reminder Time"
        items={TIME_OPTIONS}
        value={TIME_OPTIONS.find((o) => o.value === reminderTime) ?? TIME_OPTIONS[0]}
        onChange={(item) => handleTimeChange(item.value)}
        keyExtractor={(item) => item.value}
        renderItem={(item, selected, onSelect) => (
          <TouchableOpacity
            onPress={onSelect}
            className="items-center justify-center py-3"
          >
            <AppText
              variant="body-medium"
              className={selected ? "text-primary text-sm font-semibold" : "text-white text-sm"}
            >
              {item.label}
            </AppText>
          </TouchableOpacity>
        )}
        columns={3}
        snapPoints={["50%", "75%"]}
      />
    </SafeAreaView>
  );
}
