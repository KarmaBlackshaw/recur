import React, { useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { isWithinInterval, addDays, startOfDay, parseISO } from "date-fns";
import { useExpenses } from "../context/ExpenseContext";
import { ExpenseCard } from "../components/ExpenseCard";
import { AddExpenseModal } from "../components/AddExpenseModal";
import { KpiRow } from "../components/KpiRow";
import { EmptyState } from "../components/EmptyState";
import { isOverdue } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
}

export default function HomeScreen() {
  const { expenses, loading } = useExpenses();
  const modalRef = useRef<BottomSheetModal>(null) as React.RefObject<BottomSheetModal>;

  const sections: Section[] = useMemo(() => {
    const today = startOfDay(new Date());
    const in30 = addDays(today, 30);

    const overdue = expenses.filter(
      (e) => e.status === "unpaid" && isOverdue(e.dueDate)
    );
    const upcoming = expenses.filter((e) => {
      const d = parseISO(e.dueDate);
      return isWithinInterval(d, { start: today, end: in30 }) && !isOverdue(e.dueDate);
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

  function openModal() {
    modalRef.current?.present();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={colors.secondary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Recur</Text>
      </View>

      {/* KPI row */}
      {expenses.length > 0 && <KpiRow expenses={expenses} />}

      {/* Expense sections */}
      {expenses.length === 0 ? (
        <EmptyState onAdd={openModal} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <ExpenseCard expense={item} index={index} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, section.accent ? { color: section.accent } : {}]}>
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal} accessibilityLabel="Add expense">
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add modal */}
      <AddExpenseModal bottomSheetRef={modalRef} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: "Caveat_700Bold",
    letterSpacing: 1,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  listContent: {
    paddingBottom: 40,
  },
});
