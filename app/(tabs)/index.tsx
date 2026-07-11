import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { ExpenseCard } from "../../components/ExpenseCard";
import { DayWindowSelector, windowLabel, type DayWindow } from "../../components/DayWindowSelector";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate, getGreeting, getFormattedDate } from "../../utils/dateHelpers";
import { usePaidLedger } from "../../utils/usePaidLedger";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

// A rendered row: the expense plus the cycle month its card resolves against.
// Overdue/Upcoming point at the current month; Recently Paid points at the paid
// cycle's own month (so an advance payment edits/prices the right cycle).
interface Row {
  key: string;
  expense: Expense;
  refDate: Date;
}

interface Section {
  title: string;
  data: Row[];
  accent?: string;
  emptyHint?: string;
}

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus } = useExpenses();
  const ledger = usePaidLedger();
  const [windowDays, setWindowDays] = useState<DayWindow>(7);
  const today = dayjs().startOf("day").toDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  const sections = useMemo<Section[]>(() => {
    const monthRef = new Date(year, month, 1);
    const toRow = (e: Expense): Row => ({ key: e.id, expense: e, refDate: monthRef });

    const inN = dayjs(today).add(windowDays, "day").toDate();
    const overdue: Expense[] = [];
    const upcoming: Expense[] = [];
    for (const e of expenses) {
      if (e.recurrence === "one-off") continue;
      if (getMonthStatus(e.id, year, month) !== "unpaid") continue;
      if (isOverdueOn(e.dueDay, year, month)) {
        overdue.push(e);
      } else {
        const d = getDueDate(e.dueDay);
        if (d >= today && d <= inN) upcoming.push(e);
      }
    }
    overdue.sort((a, b) => a.dueDay - b.dueDay);
    upcoming.sort((a, b) => a.dueDay - b.dueDay);

    // Recently Paid: any paid entry (recurring cycle or one-off) whose pay-date
    // lands in the rolling last-N-day window. Upper bound is end-of-today because
    // pay timestamps carry a time-of-day; the ledger is already sorted newest-first.
    const lastN = dayjs(today).subtract(windowDays, "day").toDate();
    const endToday = dayjs().endOf("day").toDate();
    const recent = ledger.filter((it) => it.effDate >= lastN && it.effDate <= endToday);

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", data: overdue.map(toRow), accent: colors.overdue });
    }
    result.push({
      title: "Upcoming",
      data: upcoming.map(toRow),
      accent: colors.secondary,
      emptyHint: `Nothing due in the next ${windowLabel(windowDays).toLowerCase()}`,
    });
    if (recent.length > 0) {
      result.push({ title: "Recently Paid", data: recent, accent: colors.paid });
    }
    return result;
  }, [expenses, getMonthStatus, ledger, year, month, windowDays]);

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
          <Text className="text-white text-[28px] tracking-wide" style={{ fontFamily: "Oswald_Medium" }}>
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

      {expenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=regular")} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={
            <View>
              <Text
                className="px-5 pt-2 pb-1 text-[11px] uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Quicksand_700Bold" }}
              >
                This Month
              </Text>
              <KpiRow year={year} month={month} />
              <DayWindowSelector value={windowDays} onChange={setWindowDays} />
            </View>
          }
          renderItem={({ item, index }) => (
            <ExpenseCard
              expense={item.expense}
              index={index}
              referenceDate={item.refDate}
              onPress={() => router.push({ pathname: "/expense/add", params: { id: item.expense.id, year: item.refDate.getFullYear(), month: item.refDate.getMonth() } })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-5 pt-5 pb-2 flex-row items-center gap-2">
              {(section as Section).accent === colors.overdue && (
                <Feather name="alert-triangle" size={12} color={colors.overdue} />
              )}
              <Text
                className="text-[11px] font-['Quicksand_700Bold'] uppercase tracking-widest"
                style={{ color: (section as Section).accent ?? "rgba(255,255,255,0.4)" }}
              >
                {section.title}
              </Text>
            </View>
          )}
          renderSectionFooter={({ section }) => {
            const s = section as Section;
            if (s.data.length > 0 || !s.emptyHint) return null;
            return (
              <View className="mx-5 mt-1 flex-row items-center gap-2 bg-surface rounded-2xl px-4 py-3.5 border border-white/[0.07]">
                <Feather name="check-circle" size={15} color={colors.paid} />
                <Text className="text-white/60 text-[13px] font-['Quicksand_500Medium']">{s.emptyHint}</Text>
              </View>
            );
          }}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
