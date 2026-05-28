import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { isWithinInterval, addDays, startOfToday } from "date-fns";
import { useExpenses } from "../context/ExpenseContext";
import { ExpenseCard } from "../components/ExpenseCard";
import { KpiRow } from "../components/KpiRow";
import { EmptyState } from "../components/EmptyState";
import { isOverdueOn, getDueDate, getGreeting, getFormattedDate } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
  referenceDate?: Date;
}

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus } = useExpenses();
  const { sections, currentMonthList } = useMemo(() => {
    const today = startOfToday();
    const in30 = addDays(today, 30);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const nextMonthYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
    const currentMonthRef = new Date(currentYear, currentMonth, 1);
    const nextMonthRef = new Date(nextMonthYear, nextMonth, 1);

    const resolve = (e: Expense, year: number, month: number): Expense =>
      ({ ...e, status: getMonthStatus(e.id, year, month) });

    const currentMonthList = expenses.map((e) => resolve(e, currentYear, currentMonth));
    const nextMonthList = expenses
      .filter((e) => e.recurrence !== "one-off")
      .map((e) => resolve(e, nextMonthYear, nextMonth));

    const overdue = currentMonthList
      .filter((e) => e.status === "unpaid" && isOverdueOn(e.dueDay, currentYear, currentMonth))
      .sort((a, b) => a.dueDay - b.dueDay);
    const upcoming = currentMonthList
      .filter((e) => {
        const d = getDueDate(e.dueDay);
        return (
          isWithinInterval(d, { start: today, end: in30 }) &&
          !isOverdueOn(e.dueDay, currentYear, currentMonth)
        );
      })
      .sort((a, b) => a.dueDay - b.dueDay);

    // IDs already shown in Overdue or Upcoming — excluded from This Month
    const shownIds = new Set([...overdue, ...upcoming].map((e) => e.id));

    const thisMonthExpenses = currentMonthList
      .filter((e) => !shownIds.has(e.id))
      .sort((a, b) => a.dueDay - b.dueDay);

    const nextMonthExpenses = [...nextMonthList].sort((a, b) => a.dueDay - b.dueDay);

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
    return { sections: result, currentMonthList };
  }, [expenses, getMonthStatus]);

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
          <Text
            className="text-white text-[28px] tracking-wide"
            style={{ fontFamily: "Oswald_Medium" }}
          >
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

      {/* KPI row */}
      {expenses.length > 0 && <KpiRow expenses={currentMonthList} />}

      {/* Divider */}
      {expenses.length > 0 && (
        <View className="mx-5 mt-3 mb-1 h-px bg-white/[0.06]" />
      )}

      {/* Expense sections */}
      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/add-expense")} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) => (
            <ExpenseCard expense={item} index={index} referenceDate={(section as Section).referenceDate} />
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
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 size-[60px] rounded-full bg-primary items-center justify-center"
        style={{
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }}
        onPress={() => router.push("/add-expense")}
        accessibilityLabel="Add expense"
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}
