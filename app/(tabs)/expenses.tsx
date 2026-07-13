import React, { useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { MonthNavigator } from "../../components/MonthNavigator";
import { DayGroupedExpenseList, type DayEntry } from "../../components/DayGroupedExpenseList";
import { formatAmount } from "../../utils/dateHelpers";
import { usePaidLedger } from "../../utils/usePaidLedger";
import { colors } from "../../constants/theme";

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const ledger = usePaidLedger();
  const today = dayjs().startOf("day").toDate();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { entries, total } = useMemo(() => {
    // Ledger is pre-sorted descending by pay-date, so the component's day sections
    // come out newest-first with no extra sort.
    const items = ledger.filter(
      (it) => it.effDate.getFullYear() === selectedYear && it.effDate.getMonth() === selectedMonth
    );
    const entries: DayEntry[] = items.map((it) => ({ ...it, compact: true }));
    const total = items.reduce((sum, it) => sum + it.amount, 0);
    return { entries, total };
  }, [ledger, selectedYear, selectedMonth]);

  const monthLabel = dayjs(new Date(selectedYear, selectedMonth, 1)).format("MMMM");

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
        <Text className="text-[11px] uppercase tracking-widest text-textMuted font-quicksand-bold">
          Paid this month
        </Text>
        <Text className="text-[17px] text-paid font-oswald-medium">
          {formatAmount(total)}
        </Text>
      </View>
      <View className="mx-5 mt-2 mb-1 h-px bg-white/[0.06]" />

      <DayGroupedExpenseList
        entries={entries}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="text-white/30 text-sm font-quicksand-medium">
              No expenses paid in {monthLabel}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
