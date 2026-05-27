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
import { isOverdue, getDueDate } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
}

export default function HomeScreen() {
  const { expenses, loading } = useExpenses();

  const sections: Section[] = useMemo(() => {
    const today = startOfToday();
    const in30 = addDays(today, 30);

    const overdue = expenses.filter(
      (e) => e.status === "unpaid" && isOverdue(e.dueDay)
    );
    const upcoming = expenses.filter((e) => {
      const d = getDueDate(e.dueDay);
      return isWithinInterval(d, { start: today, end: in30 }) && !isOverdue(e.dueDay);
    });

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", data: overdue, accent: colors.overdue });
    }
    if (upcoming.length > 0) {
      result.push({ title: "Upcoming — Next 30 Days", data: upcoming, accent: colors.secondary });
    }
    result.push({ title: "All Expenses", data: expenses });
    return result;
  }, [expenses]);

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
      <View className="flex-row justify-between items-center px-5 pt-2 pb-3">
        <Text className="text-white text-[34px] tracking-wide" style={{ fontFamily: "Oswald_Medium" }}>Recur</Text>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/[0.07] items-center justify-center"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings")}
        >
          <Feather name="settings" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {/* KPI row */}
      {expenses.length > 0 && <KpiRow expenses={expenses} />}

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
          renderItem={({ item, index }) => <ExpenseCard expense={item} index={index} />}
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
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center"
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
