import React, { useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { format, startOfToday, parseISO } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { MonthNavigator } from "../../components/MonthNavigator";
import { formatAmount, getDueDateForMonth } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

export default function ExpensesScreen() {
  const { expenses, loading, getMonthStatus, getMonthAmount, getMonthPaidAt } = useExpenses();
  const today = startOfToday();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { paidList, total } = useMemo(() => {
    const resolveAmount = (e: Expense): number =>
      e.isVariable ? (getMonthAmount(e.id, selectedYear, selectedMonth) ?? 0) : (e.amount ?? 0);

    // Paid date: one-offs use their stored paidDate; recurring use the month's recorded
    // paid_at, falling back to the month's due date when no timestamp was recorded.
    const paidTime = (e: Expense): number => {
      if (e.recurrence === "one-off") {
        return (e.paidDate ? parseISO(e.paidDate) : new Date(e.createdAt)).getTime();
      }
      const pa = getMonthPaidAt(e.id, selectedYear, selectedMonth);
      return (pa ? parseISO(pa) : getDueDateForMonth(e.dueDay, selectedYear, selectedMonth)).getTime();
    };

    const list = expenses
      .filter((e) => {
        if (e.recurrence === "one-off") {
          if (e.status !== "paid") return false;
          const c = new Date(e.createdAt);
          return c.getFullYear() === selectedYear && c.getMonth() === selectedMonth;
        }
        return getMonthStatus(e.id, selectedYear, selectedMonth) === "paid";
      })
      .sort((a, b) => paidTime(b) - paidTime(a));

    const total = list.reduce((sum, e) => sum + resolveAmount(e), 0);
    return { paidList: list, total };
  }, [expenses, getMonthStatus, getMonthAmount, getMonthPaidAt, selectedYear, selectedMonth]);

  const monthLabel = format(new Date(selectedYear, selectedMonth, 1), "MMMM");

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.secondary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
      />

      <View className="flex-row items-baseline justify-between px-5 pt-2 pb-1">
        <Text
          className="text-[11px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Quicksand_700Bold" }}
        >
          Paid this month
        </Text>
        <Text className="text-[17px]" style={{ color: colors.paid, fontFamily: "Oswald_Medium" }}>
          {formatAmount(total)}
        </Text>
      </View>
      <View className="mx-5 mt-2 mb-1 h-px bg-white/[0.06]" />

      <FlatList
        data={paidList}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item}
            index={index}
            referenceDate={new Date(selectedYear, selectedMonth, 1)}
            onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
          />
        )}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-white/30 text-sm font-['Quicksand_500Medium']">
              No expenses paid in {monthLabel}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
