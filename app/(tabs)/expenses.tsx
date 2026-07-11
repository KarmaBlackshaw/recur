import React, { useMemo, useState } from "react";
import { View, Text, SectionList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { MonthNavigator } from "../../components/MonthNavigator";
import { formatAmount } from "../../utils/dateHelpers";
import { usePaidLedger, type PaidEntry } from "../../utils/usePaidLedger";
import { colors } from "../../constants/theme";

interface DaySection {
  key: string;
  date: Date;
  dayTotal: number;
  data: PaidEntry[];
}

// Weekend accent: Sun red, Sat indigo, weekdays muted (mirrors the reference ledger).
function weekdayColor(date: Date): string {
  const d = dayjs(date).day();
  if (d === 0) return colors.overdue;
  if (d === 6) return colors.secondary;
  return colors.textMuted;
}

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const ledger = usePaidLedger();
  const today = dayjs().startOf("day").toDate();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { sections, total } = useMemo(() => {
    const items = ledger.filter(
      (it) => it.effDate.getFullYear() === selectedYear && it.effDate.getMonth() === selectedMonth
    );

    // Bucket into day groups. The ledger is pre-sorted descending by pay-date, so
    // Map insertion order yields sections newest-day-first with no extra sort.
    const groups = new Map<string, DaySection>();
    for (const it of items) {
      const key = dayjs(it.effDate).format("YYYY-MM-DD");
      let g = groups.get(key);
      if (!g) {
        g = { key, date: it.effDate, dayTotal: 0, data: [] };
        groups.set(key, g);
      }
      g.data.push(it);
      g.dayTotal += it.amount;
    }

    const total = items.reduce((sum, it) => sum + it.amount, 0);
    return { sections: [...groups.values()], total };
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

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item.expense}
            index={index}
            compact
            referenceDate={item.refDate}
            onPress={() => router.push({ pathname: "/expense/add", params: { id: item.expense.id, year: item.refDate.getFullYear(), month: item.refDate.getMonth() } })}
          />
        )}
        renderSectionHeader={({ section }) => {
          const s = section as DaySection;
          return (
            <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-white text-[22px] font-oswald-medium">
                  {dayjs(s.date).format("D")}
                </Text>
                <Text
                  className="text-[11px] font-quicksand-bold uppercase tracking-wider"
                  style={{ color: weekdayColor(s.date) }}
                >
                  {dayjs(s.date).format("ddd")}
                </Text>
                <Text className="text-white/30 text-[11px] font-quicksand-medium">
                  {dayjs(s.date).format("MMM YYYY")}
                </Text>
              </View>
              <Text className="text-white/70 text-[13px] font-oswald-medium">
                {formatAmount(s.dayTotal)}
              </Text>
            </View>
          );
        }}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[140px]"
        showsVerticalScrollIndicator={false}
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
