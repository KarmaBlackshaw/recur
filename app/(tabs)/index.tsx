import React, { useMemo } from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import sortBy from "lodash/sortBy";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { KpiRow } from "@/components/kpi/KpiRow";
import { LoanSummaryCard } from "@/components/loans/LoanSummaryCard";
import { type DayEntry } from "@/components/DayGroupedExpenseList";
import { HomeExpenseSections, type HomeEntry } from "@/components/HomeExpenseSections";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { isOverdueOn, getDueDate, getDueDateForMonth, getGreeting, getFormattedDate } from "@/utils/dateHelpers";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { isBillTbd } from "@/utils/cardBills";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";

const UPCOMING_LIMIT = 5;
const ACTIVITY_LIMIT = 10;

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, resolveAmount } = useExpenses();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const today = dayjs().startOf("day").toDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Unpaid recurring cycles, split by urgency. Overdue always shows in full;
  // Upcoming is capped to the next UPCOMING_LIMIT dues.
  const dueEntry = (e: (typeof expenses)[number]): DayEntry => ({
    key: e.id,
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, year, month),
    refDate: new Date(year, month, 1),
    amount: resolveAmount(e, year, month),
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

  const overdue = useMemo<HomeEntry[]>(() => {
    const entries = expenses
      .filter(
        (e) =>
          e.recurrence !== "one-off" &&
          getMonthStatus(e.id, year, month) === "unpaid" &&
          isOverdueOn(e.dueDay, year, month)
      )
      .map(dueEntry);
    const bills = openBills.filter((b) => !b.bill.isPaid && b.effDate < today);
    return sortBy([...entries, ...bills], "effDate");
  }, [expenses, getMonthStatus, resolveAmount, year, month, openBills]);

  const upcoming = useMemo<HomeEntry[]>(() => {
    const entries = expenses
      .filter((e) => {
        if (e.recurrence === "one-off") {
          return false;
        }
        if (getMonthStatus(e.id, year, month) !== "unpaid") {
          return false;
        }
        if (isOverdueOn(e.dueDay, year, month)) {
          return false;
        }
        return getDueDate(e.dueDay) >= today;
      })
      .map(dueEntry);
    const bills = openBills.filter((b) => b.effDate >= today);
    return sortBy([...entries, ...bills], "effDate").slice(0, UPCOMING_LIMIT);
  }, [expenses, getMonthStatus, resolveAmount, year, month, openBills]);

  const recentActivity = useMemo(() => {
    const endToday = dayjs().endOf("day").toDate();
    return feed.all.filter(({ effDate }) => effDate <= endToday).slice(0, ACTIVITY_LIMIT);
  }, [feed]);

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
