import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { addDays, startOfToday, parseISO } from "date-fns";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { ExpenseCard } from "../../components/ExpenseCard";
import { DayWindowSelector, windowLabel, type DayWindow } from "../../components/DayWindowSelector";
import { EmptyState } from "../../components/EmptyState";
import { isOverdueOn, getDueDate, getGreeting, getFormattedDate } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { Expense } from "../../types";

interface Section {
  title: string;
  data: Expense[];
  accent?: string;
  emptyHint?: string;
}

export default function HomeScreen() {
  const { expenses, loading, userName, getMonthStatus, getMonthPaidAt } = useExpenses();
  const [windowDays, setWindowDays] = useState<DayWindow>(7);
  const today = startOfToday();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthRef = new Date(year, month, 1);

  const sections = useMemo<Section[]>(() => {
    const inN = addDays(today, windowDays);
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

    const lastN = addDays(today, -windowDays);
    const inWindow = (d: Date) => d >= lastN && d <= today;
    // Paid date: one-offs use paidDate; recurring use the month's recorded paid_at,
    // falling back to the due date when no timestamp exists (legacy paid months).
    const paidDateOf = (e: Expense): Date => {
      if (e.recurrence === "one-off") {
        return e.paidDate ? parseISO(e.paidDate) : getDueDate(e.dueDay);
      }
      const pa = getMonthPaidAt(e.id, year, month);
      return pa ? parseISO(pa) : getDueDate(e.dueDay);
    };
    const recent: Expense[] = [];
    for (const e of expenses) {
      if (e.recurrence === "one-off") {
        if (e.status === "paid" && e.paidDate && inWindow(parseISO(e.paidDate))) {
          recent.push(e);
        }
      } else {
        if (getMonthStatus(e.id, year, month) === "paid" && inWindow(paidDateOf(e))) {
          recent.push(e);
        }
      }
    }
    recent.sort((a, b) => paidDateOf(b).getTime() - paidDateOf(a).getTime());

    const result: Section[] = [];
    if (overdue.length > 0) {
      result.push({ title: "Overdue", data: overdue, accent: colors.overdue });
    }
    result.push({
      title: "Upcoming",
      data: upcoming,
      accent: colors.secondary,
      emptyHint: `Nothing due in the next ${windowLabel(windowDays).toLowerCase()}`,
    });
    if (recent.length > 0) {
      result.push({ title: "Recently Paid", data: recent, accent: colors.paid });
    }
    return result;
  }, [expenses, getMonthStatus, getMonthPaidAt, year, month, windowDays]);

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
          keyExtractor={(item) => item.id}
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
              expense={item}
              index={index}
              referenceDate={monthRef}
              onPress={() => router.push({ pathname: "/expense/add", params: { id: item.id, year, month } })}
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
