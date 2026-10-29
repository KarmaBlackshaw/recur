import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { PREF_REMINDER_TIME, PREF_SETUP_CHECKLIST_DISMISSED } from "@/constants/preferences";
import { getPreference, setPreference } from "@/db/preferences";

export interface SetupStep {
  key: string;
  label: string;
  href: Href;
  isDone: boolean;
}

export interface SetupChecklistState {
  steps: SetupStep[];
  // The prefs, expenses and accounts are all loaded, so `isShown` can be trusted.
  isLoaded: boolean;
  // Not dismissed, and at least one step is left.
  isShown: boolean;
  dismiss: () => Promise<void>;
}

type ChecklistPrefs = { isDismissed: boolean; hasReminderTime: boolean };

// First-run setup: a recurring bill, a bank account or card, and a reminder time. The prefs are re-read whenever the
// screen regains focus, so a step done on another screen is ticked off on the way back.
export function useSetupChecklist(): SetupChecklistState {
  const { expenses, loading: isExpensesLoading } = useExpenses();
  const { accounts, isLoading: isAccountsLoading } = useAccounts();
  const [prefs, setPrefs] = useState<ChecklistPrefs | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function load() {
        const [dismissed, reminderTime] = await Promise.all([
          getPreference(PREF_SETUP_CHECKLIST_DISMISSED),
          getPreference(PREF_REMINDER_TIME),
        ]);
        if (isActive) {
          setPrefs({ isDismissed: dismissed === "true", hasReminderTime: reminderTime !== null });
        }
      }
      load();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const dismiss = useCallback(async () => {
    setPrefs((p) => (p ? { ...p, isDismissed: true } : p));
    await setPreference(PREF_SETUP_CHECKLIST_DISMISSED, "true");
  }, []);

  const steps: SetupStep[] = [
    {
      key: "bill",
      label: "Add your first recurring bill",
      href: "/expense/add?type=recurring",
      isDone: expenses.some((e) => e.recurrence !== "one-off"),
    },
    {
      key: "account",
      label: "Add a bank account or card",
      href: "/account/edit",
      isDone: accounts.some((a) => a.id !== CASH_ACCOUNT_ID),
    },
    {
      key: "reminder",
      label: "Pick a reminder time",
      href: "/settings",
      isDone: prefs?.hasReminderTime ?? false,
    },
  ];

  const isLoaded = prefs !== null && !isExpensesLoading && !isAccountsLoading;

  return {
    steps,
    isLoaded,
    isShown: isLoaded && !prefs.isDismissed && steps.some((s) => !s.isDone),
    dismiss,
  };
}

interface Props {
  steps: SetupStep[];
  hasExpenses: boolean;
  onDismiss: () => void;
}

export function SetupChecklist({ steps, hasExpenses, onDismiss }: Props) {
  return (
    <View className="mx-5 mt-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <View className="flex-row items-start">
        <View className="flex-1 pt-1">
          <AppText variant="title" className="text-[18px]" accessibilityRole="header">
            Get started
          </AppText>
          <AppText variant="meta">Track what's due each month in three steps.</AppText>
        </View>
        <TouchableOpacity
          className="w-[44px] h-[44px] -mr-3 -mt-1 items-center justify-center"
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss setup"
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View className="mt-1">
        {steps.map(({ key, label, href, isDone }) => (
          <TouchableOpacity
            key={key}
            className="flex-row items-center gap-3 min-h-[52px]"
            activeOpacity={0.7}
            onPress={() => router.push(href)}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${isDone ? "done" : "not done"}`}
          >
            <Feather
              name={isDone ? "check-circle" : "circle"}
              size={20}
              color={isDone ? colors.paid : colors.textMuted}
            />
            <AppText variant="body-medium" className={`flex-1 text-[14px] ${isDone ? "text-textMuted" : ""}`}>
              {label}
            </AppText>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {hasExpenses ? null : (
        <TouchableOpacity
          className="self-start min-h-[44px] justify-center"
          onPress={() => router.push("/expense/add?type=regular")}
          accessibilityRole="button"
          accessibilityLabel="Log a one-off expense instead"
        >
          <AppText variant="body-bold" className="text-[13px] text-secondary">
            Log a one-off expense instead
          </AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}
