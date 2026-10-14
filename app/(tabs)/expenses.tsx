import React, { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { MonthNavigator } from "../../components/MonthNavigator";
import { DayGroupedExpenseList, type DayEntry } from "../../components/DayGroupedExpenseList";
import { formatAmount } from "../../utils/dateHelpers";
import { usePaidLedger } from "../../utils/usePaidLedger";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { AppText } from "../../components/ui/AppText";

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
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between pl-5 pr-2 pt-2 pb-1">
        <AppText variant="display">Paid</AppText>
        <MonthNavigator
          year={selectedYear}
          month={selectedMonth}
          onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        />
      </View>

      <View className="mx-5 mt-2 mb-1 rounded-2xl bg-paid/10 border border-paid/20 p-5">
        <AppText variant="overline">Paid this month</AppText>
        <Text
          className="text-[32px] text-paid font-oswald-medium mt-1"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {formatAmount(total)}
        </Text>
        <AppText variant="meta">
          {entries.length} {entries.length === 1 ? "payment" : "payments"}
        </AppText>
      </View>

      <DayGroupedExpenseList
        entries={entries}
        ListEmptyComponent={<EmptyState title="Nothing paid" icon="check-circle" message={`No expenses paid in ${monthLabel}`} />}
      />
    </SafeAreaView>
  );
}
