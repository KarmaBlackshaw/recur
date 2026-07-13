import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { type DayEntry } from "../../components/DayGroupedExpenseList";
import { HomeExpenseSections } from "../../components/HomeExpenseSections";
import { DayWindowSelector, windowLabel, type DayWindow } from "../../components/DayWindowSelector";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate, getDueDateForMonth, getGreeting, getFormattedDate } from "../../utils/dateHelpers";
import { usePaidLedger } from "../../utils/usePaidLedger";
import { colors } from "../../constants/theme";

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, getMonthAmount } = useExpenses();
  const ledger = usePaidLedger();
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
    amount: e.isVariable ? (getMonthAmount(e.id, year, month) ?? 0) : (e.amount ?? 0),
  });

  const overdue = useMemo<DayEntry[]>(() => {
    return expenses
      .filter(
        (e) =>
          e.recurrence !== "one-off" &&
          getMonthStatus(e.id, year, month) === "unpaid" &&
          isOverdueOn(e.dueDay, year, month)
      )
      .map(dueEntry)
      .sort((a, b) => a.effDate.getTime() - b.effDate.getTime());
  }, [expenses, getMonthStatus, getMonthAmount, year, month]);

  const upcoming = useMemo<DayEntry[]>(() => {
    const inN = dayjs(today).add(windowDays, "day").toDate();
    return expenses
      .filter((e) => {
        if (e.recurrence === "one-off") return false;
        if (getMonthStatus(e.id, year, month) !== "unpaid") return false;
        if (isOverdueOn(e.dueDay, year, month)) return false;
        const d = getDueDate(e.dueDay);
        return d >= today && d <= inN;
      })
      .map(dueEntry)
      .sort((a, b) => a.effDate.getTime() - b.effDate.getTime());
  }, [expenses, getMonthStatus, getMonthAmount, year, month, windowDays]);

  // Recently Paid: any paid entry whose pay-date lands in the rolling window.
  const recentlyPaid = useMemo<DayEntry[]>(() => {
    const lastN = dayjs(today).subtract(windowDays, "day").toDate();
    const endToday = dayjs().endOf("day").toDate();
    return ledger
      .filter((it) => it.effDate >= lastN && it.effDate <= endToday)
      .sort((a, b) => b.effDate.getTime() - a.effDate.getTime())
      .map((it) => ({ ...it, compact: true }));
  }, [ledger, windowDays]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.secondary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row justify-between items-start px-5 pt-2 pb-3">
        <View>
          <Text
            className="text-[11px] tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Quicksand_700Bold" }}
          >
            {getFormattedDate().toUpperCase()}
          </Text>
          <Text className="text-white text-[28px] tracking-wide" style={{ fontFamily: "Oswald_Medium" }}>
            {getGreeting(userName)}
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/[0.07] items-center justify-center mt-1"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Feather name="settings" size={18} color="rgba(255,255,255,0.6)" />
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
              <Text
                className="px-5 pt-2 pb-1 text-[11px] uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Quicksand_700Bold" }}
              >
                This Month
              </Text>
              <KpiRow year={year} month={month} />
              <DayWindowSelector value={windowDays} onChange={setWindowDays} />
            </View>
          }
          ListEmptyComponent={
            <View className="mx-5 mt-1 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-white/[0.07]">
              <Feather name="check-circle" size={15} color={colors.paid} />
              <Text className="text-white/60 text-[13px] font-['Quicksand_500Medium']">
                Nothing due or paid in the last/next {windowLabel(windowDays).toLowerCase()}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
