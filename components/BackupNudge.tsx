import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { PREF_BACKUP_NUDGE_SNOOZED_AT, PREF_LAST_BACKUP_AT } from "@/constants/preferences";
import { getPreference, setPreference } from "@/db/preferences";
import { exportBackup } from "@/utils/backup";

// The nudge comes back once the last backup, and the last "Not now", are older than this.
const NUDGE_AFTER_DAYS = 30;

type BackupPrefs = { lastBackupAt: dayjs.Dayjs | null; snoozedAt: dayjs.Dayjs | null };

function toDayjs(iso: string | null): dayjs.Dayjs | null {
  if (iso == null) {
    return null;
  }
  const at = dayjs(iso);
  return at.isValid() ? at : null;
}

async function readBackupPrefs(): Promise<BackupPrefs> {
  const [lastBackupAt, snoozedAt] = await Promise.all([
    getPreference(PREF_LAST_BACKUP_AT),
    getPreference(PREF_BACKUP_NUDGE_SNOOZED_AT),
  ]);
  return { lastBackupAt: toDayjs(lastBackupAt), snoozedAt: toDayjs(snoozedAt) };
}

function isStale(at: dayjs.Dayjs | null): boolean {
  return at == null || at.isBefore(dayjs().subtract(NUDGE_AFTER_DAYS, "day"));
}

// Everything lives on this phone, so Home asks for a backup once a month until one is made.
export function BackupNudge() {
  const [prefs, setPrefs] = useState<BackupPrefs | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Re-read on focus: a backup made from Settings hides the nudge on the way back.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function load() {
        const next = await readBackupPrefs();
        if (isActive) {
          setPrefs(next);
        }
      }
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  if (prefs == null || !isStale(prefs.lastBackupAt) || !isStale(prefs.snoozedAt)) {
    return null;
  }

  async function handleBackUp() {
    setIsExporting(true);
    try {
      await exportBackup();
    } catch (e: unknown) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsExporting(false);
    }
    setPrefs(await readBackupPrefs());
  }

  async function handleNotNow() {
    const now = new Date().toISOString();
    setPrefs((p) => (p ? { ...p, snoozedAt: dayjs(now) } : p));
    await setPreference(PREF_BACKUP_NUDGE_SNOOZED_AT, now);
  }

  const daysSinceBackup = prefs.lastBackupAt ? dayjs().diff(prefs.lastBackupAt, "day") : null;
  const message =
    daysSinceBackup == null
      ? "Never backed up"
      : `Last backup ${daysSinceBackup} ${daysSinceBackup === 1 ? "day" : "days"} ago`;

  // One compact row, so it never pushes the due list down far.
  return (
    <View className="mx-5 mt-3 flex-row items-center gap-3 rounded-2xl border border-border bg-surface pl-3 pr-1 py-1.5">
      <View className="w-[36px] h-[36px] rounded-xl bg-secondary/15 items-center justify-center">
        <Feather name="upload-cloud" size={17} color={colors.secondary} />
      </View>
      <View className="flex-1" accessible accessibilityLabel={`Back up your data. ${message}`}>
        <AppText variant="body-bold" className="text-[14px]" numberOfLines={1}>
          Back up your data
        </AppText>
        <AppText variant="meta" numberOfLines={1}>
          {message}
        </AppText>
      </View>
      <TouchableOpacity
        className="min-h-[44px] min-w-[44px] items-center justify-center px-2"
        onPress={handleBackUp}
        disabled={isExporting}
        accessibilityRole="button"
        accessibilityLabel="Back up"
        accessibilityHint="Exports a backup file you can save or share"
        accessibilityState={{ busy: isExporting }}
      >
        {isExporting ? (
          <ActivityIndicator color={colors.secondary} />
        ) : (
          <AppText variant="body-bold" className="text-[13px] text-secondary">
            Back up
          </AppText>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        className="w-11 h-11 items-center justify-center"
        onPress={handleNotNow}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        accessibilityHint="Hides this reminder for 30 days"
      >
        <Feather name="x" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
