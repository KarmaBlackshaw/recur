import React, { useMemo } from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { range, sortBy, sumBy } from "@/utils/collections";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { KpiRow } from "@/components/kpi/KpiRow";
import { LoanSummaryCard } from "@/components/loans/LoanSummaryCard";
import { type DayEntry } from "@/components/DayGroupedExpenseList";
import { HomeExpenseSections, type HomeEntry, type UpcomingBand } from "@/components/HomeExpenseSections";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { isOverdueOn, hasCycleIn, getDueDateForMonth, getGreeting, getFormattedDate } from "@/utils/dateHelpers";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { useLingeringEntries } from "@/utils/useLingeringEntries";
import { isBillTbd } from "@/utils/cardBills";
import { monthKey } from "@/utils/monthKey";
import { useToday } from "@/utils/useToday";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { HomeBandSlot } from "@/types";

const UPCOMING_LIMIT = 5;
const NEXT_MONTH_LOOKAHEAD_DAYS = 7;
const ACTIVITY_LIMIT = 10;
// How many months back an unpaid due stays in Overdue after its own month has ended.
const OVERDUE_LOOKBACK_MONTHS = 3;

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, resolveAmount, collapsedHomeBands, toggleHomeBand } = useExpenses();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const today = useToday();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Unpaid recurring cycles, split by urgency. Overdue always shows in full;
  // each Upcoming band lists its next UPCOMING_LIMIT dues but counts and totals the whole month.
  // Keyed per cycle: near month end the same expense can be due in both Upcoming months.
  const dueEntry = (e: (typeof expenses)[number], y: number, m: number): DayEntry => ({
    key: monthKey(e.id, y, m),
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, y, m),
    refDate: new Date(y, m, 1),
    amount: resolveAmount(e, y, m),
  });

  // Next month too: a new card's first bill is due next month.
  // A ₱0 estimate means nothing billed yet, so it stays open as TBD until the user sets the statement amount.
  const openBills = useMemo(() => {
    const next = dayjs(new Date(year, month, 1)).add(1, "month");
    return [...accounts.getCardBills(year, month), ...accounts.getCardBills(next.year(), next.month())]
      .filter((b) => !b.isPaid || isBillTbd(b))
      .map((b) => ({
        key: `bill-${b.account.id}-${b.year}-${b.month}`,
        bill: b,
        effDate: b.dueDate,
        amount: b.remaining,
      }));
  }, [accounts.getCardBills, year, month]);

  // Just-paid cards linger with their Paid badge before leaving Overdue / Upcoming.
  const isPaidNow = (e: HomeEntry) =>
    "expense" in e && getMonthStatus(e.expense.id, e.refDate.getFullYear(), e.refDate.getMonth()) === "paid";

  const overdueLive = useMemo<HomeEntry[]>(() => {
    // A missed due stays here after its month ends. Card bills don't need carrying: each statement already
    // includes the unpaid balance, so carrying them too would count it twice.
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
        data: sortBy(entries, "effDate").slice(0, UPCOMING_LIMIT),
      };
    };
    return [band(dayjs(today), "current"), band(next, "next")].filter((b) => b.data.length > 0);
  }, [upcomingWithPaid, getMonthStatus, today]);

  const recentActivity = useMemo(() => {
    const endToday = dayjs(today).endOf("day").toDate();
    return feed.all.filter(({ effDate }) => effDate <= endToday).slice(0, ACTIVITY_LIMIT);
  }, [feed, today]);

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
      <View className="flex-row justify-between items-start px-5 pt-2 pb-3">
        <View>
          <AppText variant="overline">
            {getFormattedDate().toUpperCase()}
          </AppText>
          <AppText variant="display" className="tracking-wide">
            {getGreeting(userName)}
          </AppText>
        </View>
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
        overdue={overdue}
        upcoming={upcoming}
        recentActivity={recentActivity}
        collapsedSlots={collapsedHomeBands}
        onToggleSlot={toggleHomeBand}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <View>
            <AppText variant="overline" className="px-5 pt-2 pb-1">
              This Month
            </AppText>
            <KpiRow year={year} month={month} />
            <LoanSummaryCard />
          </View>
        }
        ListEmptyComponent={
          expenses.length === 0 ? (
            <EmptyState onAdd={() => router.push("/expense/add?type=regular")} />
          ) : (
            <View className="mx-5 mt-1 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-border">
              <Feather name="inbox" size={15} color={colors.textMuted} />
              <AppText variant="meta" className="shrink">
                Nothing due and no recent activity
              </AppText>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
