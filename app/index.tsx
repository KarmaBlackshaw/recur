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
import { Ionicons } from "@expo/vector-icons";
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
      result.push({ title: "⚠ Overdue", data: overdue, accent: colors.overdue });
    }
    if (upcoming.length > 0) {
      result.push({ title: "Upcoming — Next 30 Days", data: upcoming, accent: colors.secondary });
    }
    result.push({ title: "All Expenses", data: expenses });
    return result;
  }, [expenses]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ActivityIndicator color={colors.secondary} size="large" className="mt-20" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 pt-3 pb-2">
        <Text className="text-white text-[32px] font-caveat-bold tracking-wide">Recur</Text>
      </View>

      {/* KPI row */}
      {expenses.length > 0 && <KpiRow expenses={expenses} />}

      {/* Expense sections */}
      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/add-expense")} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <ExpenseCard expense={item} index={index} />}
          renderSectionHeader={({ section }) => (
            <View className="px-4 pt-4 pb-1.5">
              <Text
                className="text-[11px] font-quicksand-bold uppercase tracking-widest"
                style={section.accent ? { color: section.accent } : { color: "rgba(255,255,255,0.5)" }}
              >
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="pb-10"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center"
        style={{
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}
        onPress={() => router.push("/add-expense")}
        accessibilityLabel="Add expense"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
