import React, { useEffect, useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useIsFocused } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { range, sortBy, sumBy } from "@/utils/collections";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { HomeMonthStats } from "@/components/HomeMonthStats";
import { SetupChecklist, useSetupChecklist } from "@/components/SetupChecklist";
import { BackupNudge } from "@/components/BackupNudge";
import { type DayEntry } from "@/components/DayGroupedExpenseList";
import { HomeExpenseSections, type HomeEntry, type UpcomingBand } from "@/components/HomeExpenseSections";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { isOverdueOn, hasCycleIn, getDueDateForMonth, getGreeting } from "@/utils/dateHelpers";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import { dayTotalOf } from "@/utils/activity/dayTotalOf";
import { netFlow } from "@/utils/activity/netFlow";
import { useOwedToYou } from "@/utils/useOwedToYou";
import { useLingeringEntries } from "@/utils/useLingeringEntries";
import { openCardBills } from "@/utils/cardBills";
import { monthKey } from "@/utils/monthKey";
import { useToday } from "@/utils/useToday";
import { colors } from "@/constants/theme";
import { PREF_SWIPE_HINT_SEEN } from "@/constants/preferences";
import { getPreference, setPreference } from "@/db/preferences";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { HomeBandSlot } from "@/types";

const NEXT_MONTH_LOOKAHEAD_DAYS = 7;
const ACTIVITY_LIMIT = 10;
// How many months back an unpaid due or card bill stays in Overdue after its own month has ended.
const OVERDUE_LOOKBACK_MONTHS = 3;
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
  return entries.map((e) => ("expense" in e && e.key === hintKey ? { ...e, isSwipeHintShown: true } : e));
}

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, resolveAmount, collapsedHomeBands, toggleHomeBand } = useExpenses();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const owed = useOwedToYou();
  const setup = useSetupChecklist();
  const isFocused = useIsFocused();
  const today = useToday();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Unpaid recurring cycles, split by urgency.
  // Keyed per cycle: near month end the same expense can be due in both Upcoming months.
  // Every due row can be paid in place (the trailing pay circle and the Pay swipe).
  const dueEntry = (e: (typeof expenses)[number], y: number, m: number): DayEntry => ({
    key: monthKey(e.id, y, m),
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, y, m),
    refDate: new Date(y, m, 1),
    amount: resolveAmount(e, y, m),
    canQuickPay: true,
  });

  // Next month too: a new card's first bill is due next month.
  const openBills = useMemo(
    () =>
      openCardBills(accounts.getCardBills, today, OVERDUE_LOOKBACK_MONTHS).map((b) => ({
        key: `bill-${b.account.id}-${b.year}-${b.month}`,
        bill: b,
        effDate: b.dueDate,
        amount: b.remaining,
      })),
    [accounts.getCardBills, today]
  );

  // Just-paid cards linger with their Paid badge before leaving Overdue / Upcoming.
  const isPaidNow = (e: HomeEntry) =>
    "expense" in e && getMonthStatus(e.expense.id, e.refDate.getFullYear(), e.refDate.getMonth()) === "paid";

  const overdueLive = useMemo<HomeEntry[]>(() => {
    // A missed due stays here after its month ends, and so does a card bill until it's paid.
    const entries = range(OVERDUE_LOOKBACK_MONTHS + 1).flatMap((monthsBack) => {
      const at = dayjs(today).subtract(monthsBack, "month");
      const [y, m] = [at.year(), at.month()];
      return expenses
        .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid" && isOverdueOn(e.dueDay, y, m))
        .map((e) => dueEntry(e, y, m));
    });
    const bills = openBills.filter((b) => !b.bill.isPaid && b.effDate < today);
    return [...entries, ...bills];
  }, [expenses, getMonthStatus, resolveAmount, year, month, openBills, today]);
  const overdueWithPaid = useLingeringEntries(overdueLive, isPaidNow);
  const overdue = useMemo(() => sortBy(overdueWithPaid, "effDate"), [overdueWithPaid]);

  const next = dayjs(today).add(1, "month").startOf("month");
  const isNextMonthNear = next.diff(today, "day") <= NEXT_MONTH_LOOKAHEAD_DAYS;

  const upcomingLive = useMemo<HomeEntry[]>(() => {
    const unpaidDues = (y: number, m: number) =>
      expenses
        .filter((e) => hasCycleIn(e, y, m) && getMonthStatus(e.id, y, m) === "unpaid")
        .map((e) => dueEntry(e, y, m));
    return [
      ...unpaidDues(year, month).filter((d) => d.effDate >= today),
      ...openBills.filter((b) => b.effDate >= today && dayjs(b.effDate).isSame(today, "month")),
      ...(isNextMonthNear
        ? [
            ...unpaidDues(next.year(), next.month()),
            ...openBills.filter((b) => dayjs(b.effDate).isSame(next, "month")),
          ]
        : []),
    ];
  }, [expenses, getMonthStatus, resolveAmount, year, month, openBills, isNextMonthNear, today]);
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
    return [...overdue, ...expanded.flatMap((b) => b.data)].find((e) => "expense" in e && !isPaidNow(e))?.key;
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
          ) : null
        }
      />
    </SafeAreaView>
  );
}
