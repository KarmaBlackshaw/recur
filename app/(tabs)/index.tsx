import React, { useEffect, useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { sortBy, sumBy } from "@/utils/collections";
import { useExpenses } from "@/context/ExpenseContext";
import { HomeMonthStats } from "@/components/HomeMonthStats";
import { SetupChecklist, useSetupChecklist } from "@/components/SetupChecklist";
import { BackupNudge } from "@/components/BackupNudge";
import { HomeExpenseSections, type HomeEntry, type UpcomingBand } from "@/components/HomeExpenseSections";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { getGreeting } from "@/utils/dateHelpers";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import { dayTotalOf } from "@/utils/activity/dayTotalOf";
import { netFlow } from "@/utils/activity/netFlow";
import { useOwedToYou } from "@/utils/useOwedToYou";
import { useLingeringEntries } from "@/utils/useLingeringEntries";
import { useDueBills } from "@/utils/useDueBills";
import { colors } from "@/constants/theme";
import { PREF_SWIPE_HINT_SEEN } from "@/constants/preferences";
import { getPreference, setPreference } from "@/db/preferences";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { HomeBandSlot } from "@/types";

const ACTIVITY_LIMIT = 10;
// Past this many expenses the user is set up; the checklist stops appearing above the due list.
const SETUP_EXPENSE_LIMIT = 3;

// The first due row Home ever shows peeks its Pay swipe once to teach it. The pref makes it once ever, not per launch.
function useSwipeHintKey(candidateKey: string | undefined): string | null {
  const [isHintDue, setIsHintDue] = useState(false);
  const [hintKey, setHintKey] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    async function load() {
      const seen = await getPreference(PREF_SWIPE_HINT_SEEN);
      if (isActive && seen === null) {
        setIsHintDue(true);
      }
    }
    load();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isHintDue || candidateKey === undefined) {
      return;
    }
    setIsHintDue(false);
    setHintKey(candidateKey);
    async function markSeen() {
      await setPreference(PREF_SWIPE_HINT_SEEN, "true");
    }
    markSeen();
  }, [isHintDue, candidateKey]);

  return hintKey;
}

function withSwipeHint(entries: HomeEntry[], hintKey: string | null): HomeEntry[] {
  if (hintKey === null) {
    return entries;
  }
  return entries.map((e) => (e.kind === "expense" && e.key === hintKey ? { ...e, isSwipeHintShown: true } : e));
}

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, collapsedHomeBands, toggleHomeBand } = useExpenses();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const owed = useOwedToYou();
  const setup = useSetupChecklist();
  const isFocused = useIsFocused();

  const { overdue: overdueLive, upcoming: upcomingLive, openBills, today } = useDueBills();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Just-paid cards linger with their Paid badge before leaving Overdue / Upcoming.
  const isPaidNow = (e: HomeEntry) =>
    e.kind === "expense" && getMonthStatus(e.expense.id, e.refDate.getFullYear(), e.refDate.getMonth()) === "paid";

  const overdueWithPaid = useLingeringEntries(overdueLive, isPaidNow);
  const overdue = useMemo(() => sortBy(overdueWithPaid, "effDate"), [overdueWithPaid]);

  const next = dayjs(today).add(1, "month").startOf("month");

  const upcomingWithPaid = useLingeringEntries(upcomingLive, isPaidNow);

  const upcoming = useMemo<UpcomingBand[]>(() => {
    const band = (monthStart: dayjs.Dayjs, slot: HomeBandSlot): UpcomingBand => {
      const entries = upcomingWithPaid.filter((e) => dayjs(e.effDate).isSame(monthStart, "month"));
      const remaining = entries.filter((e) => !isPaidNow(e));
      return {
        key: `upcoming-${monthStart.format("YYYY-MM")}`,
        slot,
        label: monthStart.format("MMMM"),
        caption: `${remaining.length} left`,
        total: sumBy(remaining, "amount"),
        data: sortBy(entries, "effDate"),
      };
    };
    return [band(dayjs(today), "current"), band(next, "next")].filter((b) => b.data.length > 0);
  }, [upcomingWithPaid, getMonthStatus, today]);

  // The list stops at ACTIVITY_LIMIT rows, often partway through a day, so each day's net counts the whole day and
  // matches that day on Activity's All list.
  const { recentActivity, recentDayNets } = useMemo(() => {
    const endToday = dayjs(today).endOf("day").toDate();
    const past = feed.all.filter(({ effDate }) => effDate <= endToday);
    const shown = past.slice(0, ACTIVITY_LIMIT);
    if (shown.length === 0) {
      return { recentActivity: shown, recentDayNets: {} };
    }
    const oldestDay = dayjs(shown[shown.length - 1].effDate).startOf("day").toDate();
    const days = groupEntriesByDay(past.filter(({ effDate }) => effDate >= oldestDay));
    return {
      recentActivity: shown,
      recentDayNets: Object.fromEntries(days.map(({ key, data }) => [key, dayTotalOf(data, netFlow)])),
    };
  }, [feed, today]);

  // The Pay swipe hint goes on the first due row in view: Overdue, else the first expanded Upcoming band. Only while
  // Home is on screen, so the peek isn't spent behind another screen.
  const swipeHintCandidate = useMemo(() => {
    const expanded = upcoming.filter((b) => !collapsedHomeBands.includes(b.slot));
    return [...overdue, ...expanded.flatMap((b) => b.data)].find((e) => e.kind === "expense" && !isPaidNow(e))?.key;
  }, [overdue, upcoming, collapsedHomeBands, getMonthStatus]);
  const swipeHintKey = useSwipeHintKey(isFocused && !loading ? swipeHintCandidate : undefined);
  const overdueRows = useMemo(() => withSwipeHint(overdue, swipeHintKey), [overdue, swipeHintKey]);
  const upcomingRows = useMemo(
    () => (swipeHintKey === null ? upcoming : upcoming.map((b) => ({ ...b, data: withSwipeHint(b.data, swipeHintKey) }))),
    [upcoming, swipeHintKey]
  );

  const hasExpenses = expenses.length > 0;
  // Mirrors the sections HomeExpenseSections builds: with none, the list shows its empty state instead.
  const hasListContent = overdue.length > 0 || upcoming.length > 0 || recentActivity.length > 0;
  // With nothing listed yet the checklist is Home's empty state. It stays above the due list only while someone is
  // still setting up, so it never pushes an established user's due list down.
  const isChecklistInHeader = setup.isShown && (hasExpenses || hasListContent) && expenses.length < SETUP_EXPENSE_LIMIT;
  const isMonthStatsShown =
    !isChecklistInHeader && (hasExpenses || openBills.length > 0 || recentActivity.length > 0 || owed != null);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between gap-3 px-5 pt-2 pb-2">
        <AppText
          variant="overline"
          className="flex-1"
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={`${getGreeting(userName)}. ${dayjs(today).format("dddd, MMMM D")}`}
        >
          {`${getGreeting(userName)} · ${dayjs(today).format("ddd, MMM D")}`.toUpperCase()}
        </AppText>
        <TouchableOpacity
          className="w-11 h-11 rounded-full bg-white/[0.07] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Feather name="settings" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <HomeExpenseSections
        overdue={overdueRows}
        upcoming={upcomingRows}
        recentActivity={recentActivity}
        recentDayNets={recentDayNets}
        collapsedSlots={collapsedHomeBands}
        onToggleSlot={toggleHomeBand}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <View>
            {isMonthStatsShown ? <HomeMonthStats year={year} month={month} feed={feed} owed={owed} /> : null}
            {isChecklistInHeader ? (
              <SetupChecklist steps={setup.steps} hasExpenses={hasExpenses} onDismiss={setup.dismiss} />
            ) : null}
            {hasExpenses ? <BackupNudge /> : null}
          </View>
        }
        ListEmptyComponent={
          hasExpenses ? (
            <View className="mx-5 mt-3 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-border">
              <Feather name="inbox" size={15} color={colors.textMuted} />
              <AppText variant="meta" className="shrink">
                Nothing due and no recent activity
              </AppText>
            </View>
          ) : setup.isShown ? (
            <SetupChecklist steps={setup.steps} hasExpenses={false} onDismiss={setup.dismiss} />
          ) : setup.isLoaded ? (
            <EmptyState
              onAdd={() => router.push("/expense/add?type=recurring")}
              secondaryLabel="Log an expense"
              onSecondary={() => router.push("/expense/add?type=regular")}
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}
