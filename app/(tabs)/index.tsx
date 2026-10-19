import React, { useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import sortBy from "lodash/sortBy";
import orderBy from "lodash/orderBy";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { KpiRow } from "@/components/kpi/KpiRow";
import { type DayEntry, type LedgerEntry } from "@/components/DayGroupedExpenseList";
import { HomeExpenseSections, type HomeEntry } from "@/components/HomeExpenseSections";
import { DayWindowSelector, windowLabel, type DayWindow } from "@/components/DayWindowSelector";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { isOverdueOn, getDueDate, getDueDateForMonth, getGreeting, getFormattedDate } from "@/utils/dateHelpers";
import { usePaidLedger, useBillPayments } from "@/utils/usePaidLedger";
import { colors } from "@/constants/theme";

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, resolveAmount } = useExpenses();
  const accounts = useAccounts();
  const ledger = usePaidLedger();
  const billPayments = useBillPayments();
  const [windowDays, setWindowDays] = useState<DayWindow>(7);
  const today = dayjs().startOf("day").toDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Unpaid recurring cycles, split by urgency. Overdue always shows (window-agnostic);
  // Upcoming is gated to the rolling [today, today+window] range.
  const dueEntry = (e: (typeof expenses)[number]): DayEntry => ({
    key: e.id,
    expense: e,
    effDate: getDueDateForMonth(e.dueDay, year, month),
    refDate: new Date(year, month, 1),
    amount: resolveAmount(e, year, month),
  });

  // Next month too: a new card's first bill is due next month.
  const openBills = useMemo(() => {
    const next = dayjs(new Date(year, month, 1)).add(1, "month");
    return [...accounts.getCardBills(year, month), ...accounts.getCardBills(next.year(), next.month())]
      .filter((b) => !b.isPaid)
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
    const bills = openBills.filter((b) => b.effDate < today);
    return sortBy([...entries, ...bills], "effDate");
  }, [expenses, getMonthStatus, resolveAmount, year, month, openBills]);

  const upcoming = useMemo<HomeEntry[]>(() => {
    const inN = dayjs(today).add(windowDays, "day").toDate();
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
        const d = getDueDate(e.dueDay);
        return d >= today && d <= inN;
      })
      .map(dueEntry);
    const bills = openBills.filter((b) => b.effDate >= today && b.effDate <= inN);
    return sortBy([...entries, ...bills], "effDate");
  }, [expenses, getMonthStatus, resolveAmount, year, month, windowDays, openBills]);

  // Recently Paid: any paid entry whose pay-date lands in the rolling window.
  const recentlyPaid = useMemo<LedgerEntry[]>(() => {
    const lastN = dayjs(today).subtract(windowDays, "day").toDate();
    const endToday = dayjs().endOf("day").toDate();
    const isInWindow = ({ effDate }: { effDate: Date }) => effDate >= lastN && effDate <= endToday;
    const expensesPaid = ledger.filter((it) => !it.isCard && isInWindow(it)).map((it) => ({ ...it, compact: true }));
    return orderBy([...expensesPaid, ...billPayments.filter(isInWindow)], "effDate", "desc");
  }, [ledger, billPayments, windowDays]);

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

      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=regular")} />
      ) : (
        <HomeExpenseSections
          overdue={overdue}
          upcoming={upcoming}
          recentlyPaid={recentlyPaid}
          ListHeaderComponent={
            <View>
              <AppText variant="overline" className="px-5 pt-2 pb-1">
                This Month
              </AppText>
              <KpiRow year={year} month={month} />
              <View className="gap-2 mx-5 mt-3 mb-1">
                <AppText variant="meta">Upcoming & paid within</AppText>
                <DayWindowSelector value={windowDays} onChange={setWindowDays} />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="mx-5 mt-1 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-border">
              <Feather name="inbox" size={15} color={colors.textMuted} />
              <AppText variant="meta" className="shrink">
                Nothing due or paid in the last/next {windowLabel(windowDays).toLowerCase()}
              </AppText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
