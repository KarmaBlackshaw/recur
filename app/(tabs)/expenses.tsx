import React, { useMemo, useState } from "react";
import { View, Text, SectionList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { format, getDay, startOfToday, parseISO } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { MonthNavigator } from "../../components/MonthNavigator";
import { formatAmount, getDueDateForMonth } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

interface DaySection {
  key: string;
  date: Date;
  dayTotal: number;
  data: Expense[];
}

// Weekend accent: Sun red, Sat indigo, weekdays muted (mirrors the reference ledger).
function weekdayColor(date: Date): string {
  const d = getDay(date);
  if (d === 0) return colors.overdue;
  if (d === 6) return colors.secondary;
  return colors.textMuted;
}

export default function ExpensesScreen() {
  const { expenses, loading, getMonthStatus, getMonthAmount, getMonthPaidAt } = useExpenses();
  const today = startOfToday();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { sections, total } = useMemo(() => {
    const resolveAmount = (e: Expense): number =>
      e.isVariable ? (getMonthAmount(e.id, selectedYear, selectedMonth) ?? 0) : (e.amount ?? 0);

    // Paid date: one-offs use their stored paidDate; recurring use the month's recorded
    // paid_at, falling back to the month's due date when no timestamp was recorded.
    const paidDate = (e: Expense): Date => {
      if (e.recurrence === "one-off") {
        return e.paidDate ? parseISO(e.paidDate) : new Date(e.createdAt);
      }
      const pa = getMonthPaidAt(e.id, selectedYear, selectedMonth);
      return pa ? parseISO(pa) : getDueDateForMonth(e.dueDay, selectedYear, selectedMonth);
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
      .sort((a, b) => paidDate(b).getTime() - paidDate(a).getTime());

    // Bucket into day groups. List is pre-sorted descending, so Map insertion order
    // yields sections newest-day-first with no extra sort.
    const groups = new Map<string, DaySection>();
    for (const e of list) {
      const d = paidDate(e);
      const key = format(d, "yyyy-MM-dd");
      let g = groups.get(key);
      if (!g) {
        g = { key, date: d, dayTotal: 0, data: [] };
        groups.set(key, g);
      }
      g.data.push(e);
      g.dayTotal += resolveAmount(e);
    }

    const total = list.reduce((sum, e) => sum + resolveAmount(e), 0);
    return { sections: [...groups.values()], total };
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
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item}
            index={index}
            compact
            referenceDate={new Date(selectedYear, selectedMonth, 1)}
            onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
          />
        )}
        renderSectionHeader={({ section }) => {
          const s = section as DaySection;
          return (
            <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-white text-[22px] font-oswald-medium">
                  {format(s.date, "d")}
                </Text>
                <Text
                  className="text-[11px] font-quicksand-bold uppercase tracking-wider"
                  style={{ color: weekdayColor(s.date) }}
                >
                  {format(s.date, "EEE")}
                </Text>
                <Text className="text-white/30 text-[11px] font-quicksand-medium">
                  {format(s.date, "MMM yyyy")}
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
