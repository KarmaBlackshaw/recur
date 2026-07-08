import React, { useMemo, useState } from "react";
import { View, Text, SectionList, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { isWithinInterval, addDays, startOfToday } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { ExpenseCard } from "../../components/ExpenseCard";
import { KpiRow } from "../../components/kpi/KpiRow";
import { MonthNavigator } from "../../components/MonthNavigator";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate, isEndedOn } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
  referenceDate?: Date;
}

export default function RecurringScreen() {
  const { expenses, loading, getMonthStatus } = useExpenses();
  const today = startOfToday();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  const recurringExpenses = useMemo(
    () => expenses.filter((e) => e.recurrence !== "one-off"),
    [expenses]
  );

  const { sections, flatList } = useMemo(() => {
    const resolveStatus = (e: Expense, year: number, month: number): Expense =>
      ({ ...e, status: getMonthStatus(e.id, year, month) });

    if (!isCurrentMonth) {
      const list = recurringExpenses
        .map((e) => resolveStatus(e, selectedYear, selectedMonth))
        .sort((a, b) => {
          const ae = isEndedOn(a.endYear, a.endMonth, selectedYear, selectedMonth) ? 1 : 0;
          const be = isEndedOn(b.endYear, b.endMonth, selectedYear, selectedMonth) ? 1 : 0;
          return ae !== be ? ae - be : a.dueDay - b.dueDay;
        });
      return { sections: [], flatList: list };
    }

    const in30 = addDays(today, 30);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthVal = currentMonth === 11 ? 0 : currentMonth + 1;
    const currentMonthRef = new Date(currentYear, currentMonth, 1);
    const nextMonthRef = new Date(nextMonthYear, nextMonthVal, 1);

    const currentMonthList = recurringExpenses.map((e) => resolveStatus(e, currentYear, currentMonth));
    const nextMonthList = recurringExpenses.map((e) => resolveStatus(e, nextMonthYear, nextMonthVal));

    const activeCurrent = currentMonthList.filter(
      (e) => !isEndedOn(e.endYear, e.endMonth, currentYear, currentMonth)
    );
    const endedNow = currentMonthList
      .filter((e) => isEndedOn(e.endYear, e.endMonth, currentYear, currentMonth))
      .sort((a, b) => a.dueDay - b.dueDay);

    const overdue = activeCurrent
      .filter((e) => e.status === "unpaid" && isOverdueOn(e.dueDay, currentYear, currentMonth))
      .sort((a, b) => a.dueDay - b.dueDay);
    const upcoming = activeCurrent
      .filter((e) => {
        if (e.status !== "unpaid") return false;
        const d = getDueDate(e.dueDay);
        return (
          isWithinInterval(d, { start: today, end: in30 }) &&
          !isOverdueOn(e.dueDay, currentYear, currentMonth)
        );
      })
      .sort((a, b) => a.dueDay - b.dueDay);

    const shownIds = new Set([...overdue, ...upcoming].map((e) => e.id));
    const thisMonthExpenses = activeCurrent
      .filter((e) => !shownIds.has(e.id))
      .sort((a, b) => a.dueDay - b.dueDay);
    const nextMonthExpenses = nextMonthList
      .filter((e) => !isEndedOn(e.endYear, e.endMonth, nextMonthYear, nextMonthVal))
      .sort((a, b) => a.dueDay - b.dueDay);

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", data: overdue, accent: colors.overdue, referenceDate: currentMonthRef });
    }
    if (upcoming.length > 0) {
      result.push({ title: "Upcoming — Next 30 Days", data: upcoming, accent: colors.secondary, referenceDate: currentMonthRef });
    }
    if (thisMonthExpenses.length > 0) {
      result.push({ title: "This Month", data: thisMonthExpenses, referenceDate: currentMonthRef });
    }
    if (nextMonthExpenses.length > 0) {
      result.push({ title: "Next Month", data: nextMonthExpenses, referenceDate: nextMonthRef });
    }
    if (endedNow.length > 0) {
      result.push({ title: "Ended", data: endedNow, referenceDate: currentMonthRef });
    }
    return { sections: result, flatList: [] };
  }, [recurringExpenses, getMonthStatus, selectedYear, selectedMonth, isCurrentMonth]);

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

      {recurringExpenses.length > 0 && (
        <KpiRow year={selectedYear} month={selectedMonth} recurringOnly />
      )}
      {recurringExpenses.length > 0 && (
        <View className="mx-5 mt-3 mb-1 h-px bg-white/[0.06]" />
      )}

      {recurringExpenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=recurring")} />
      ) : isCurrentMonth ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) => (
            <ExpenseCard
              expense={item}
              index={index}
              referenceDate={(section as Section).referenceDate}
              onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year: selectedYear, month: selectedMonth } })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-5 pt-5 pb-2 flex-row items-center gap-2">
              {section.accent === colors.overdue && (
                <Feather name="alert-triangle" size={12} color={colors.overdue} />
              )}
              <Text
                className="text-[11px] font-['Quicksand_700Bold'] uppercase tracking-widest"
                style={{ color: section.accent ?? "rgba(255,255,255,0.4)" }}
              >
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={flatList}
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
                No recurring expenses for this month
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
