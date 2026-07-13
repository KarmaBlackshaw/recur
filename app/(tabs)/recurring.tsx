import React, { useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { MonthNavigator } from "../../components/MonthNavigator";
import { EmptyState } from "../../components/EmptyState";
import { DayGroupedExpenseList, type DayEntry } from "../../components/DayGroupedExpenseList";
import { effectivePaidDate } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";

export default function RecurringScreen() {
  const { expenses, loading, getMonthStatus, getMonthAmount, getMonthPaidAt } = useExpenses();
  const today = dayjs().startOf("day").toDate();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const recurringExpenses = useMemo(
    () => expenses.filter((e) => e.recurrence !== "one-off"),
    [expenses]
  );

  const entries = useMemo(() => {
    const list: DayEntry[] = recurringExpenses.map((e) => {
      const paidAt = getMonthPaidAt(e.id, selectedYear, selectedMonth);
      const effDate = effectivePaidDate(paidAt, e.dueDay, selectedYear, selectedMonth);
      const refDate = new Date(selectedYear, selectedMonth, 1);
      const amount = e.isVariable ? (getMonthAmount(e.id, selectedYear, selectedMonth) ?? 0) : e.amount ?? 0;

      return {
        key: e.id,
        expense: e,
        effDate,
        refDate,
        amount,
        compact: false,
        hideDate: true
      };
    });
    return list.sort((a, b) => a.effDate.getTime() - b.effDate.getTime());
  }, [recurringExpenses, getMonthStatus, getMonthAmount, getMonthPaidAt, selectedYear, selectedMonth]);

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

      {recurringExpenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=recurring")} />
      ) : (
        <DayGroupedExpenseList
          entries={entries}
          ListHeaderComponent={
            <>
              <KpiRow year={selectedYear} month={selectedMonth} recurringOnly />
              <View className="mx-5 mt-3 mb-1 h-px bg-white/[0.06]" />
            </>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-20">
              <Text className="text-white/30 text-sm font-['Quicksand_500Medium']">
                No recurring expenses for this month
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
