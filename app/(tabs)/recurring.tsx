import React, { useMemo, useState } from "react";
import { View, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import dayjs from "dayjs";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiRow } from "../../components/kpi/KpiRow";
import { MonthNavigator } from "../../components/MonthNavigator";
import { EmptyState } from "../../components/EmptyState";
import { type DayEntry } from "../../components/DayGroupedExpenseList";
import { ExpenseCard } from "../../components/ExpenseCard";
import { BandHeader } from "../../components/BandHeader";
import { LoadingState } from "../../components/ui/LoadingState";
import { AppText } from "../../components/ui/AppText";
import { effectivePaidDate, isOverdueOn } from "../../utils/dateHelpers";
import { colors } from "../../constants/theme";
import type { FeatherIconName } from "../../types";

interface Band {
  key: string;
  label: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
  data: DayEntry[];
}

const BANDS: Omit<Band, "total" | "data">[] = [
  { key: "overdue", label: "Overdue", icon: "alert-triangle", accent: colors.overdue },
  { key: "unpaid", label: "Unpaid", icon: "circle", accent: colors.secondary },
  { key: "paid", label: "Paid", icon: "check-circle", accent: colors.paid },
];

export default function RecurringScreen() {
  const { expenses, loading, getMonthStatus, getMonthAmount, getMonthPaidAt } = useExpenses();
  const today = dayjs().startOf("day").toDate();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const recurringExpenses = useMemo(
    () => expenses.filter((e) => e.recurrence !== "one-off"),
    [expenses]
  );

  const bands = useMemo<Band[]>(() => {
    const ranked = recurringExpenses.map((e) => {
      const paidAt = getMonthPaidAt(e.id, selectedYear, selectedMonth);
      const effDate = effectivePaidDate(paidAt, e.dueDay, selectedYear, selectedMonth);
      const refDate = new Date(selectedYear, selectedMonth, 1);
      const amount = e.isVariable ? (getMonthAmount(e.id, selectedYear, selectedMonth) ?? 0) : e.amount ?? 0;

      const status = getMonthStatus(e.id, selectedYear, selectedMonth);
      const overdue = status === "unpaid" && isOverdueOn(e.dueDay, selectedYear, selectedMonth);
      // overdue → unpaid → paid
      const rank = overdue ? 0 : status === "unpaid" ? 1 : 2;

      const entry: DayEntry = { key: e.id, expense: e, effDate, refDate, amount };
      return { entry, rank };
    });
    ranked.sort((a, b) => a.rank - b.rank || a.entry.effDate.getTime() - b.entry.effDate.getTime());
    return BANDS.map((band, rank) => {
      const data = ranked.filter((r) => r.rank === rank).map((r) => r.entry);
      return { ...band, data, total: data.reduce((t, e) => t + e.amount, 0) };
    }).filter((band) => band.data.length > 0);
  }, [recurringExpenses, getMonthStatus, getMonthAmount, getMonthPaidAt, selectedYear, selectedMonth]);

  const monthLabel = dayjs(new Date(selectedYear, selectedMonth, 1)).format("MMMM YYYY");

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
        <AppText variant="display">Recurring</AppText>
        <MonthNavigator
          year={selectedYear}
          month={selectedMonth}
          onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m); }}
        />
      </View>

      {recurringExpenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=recurring")} />
      ) : (
        <SectionList<DayEntry, Band>
          sections={bands}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={<KpiRow year={selectedYear} month={selectedMonth} recurringOnly />}
          ListEmptyComponent={<EmptyState title="Nothing this month" icon="calendar" message={`No recurring expenses for ${monthLabel}`} />}
          renderSectionHeader={({ section }) => (
            <BandHeader
              label={section.label}
              icon={section.icon}
              accent={section.accent}
              total={section.total}
              count={section.data.length}
            />
          )}
          renderItem={({ item, index }) => (
            <ExpenseCard
              expense={item.expense}
              index={index}
              referenceDate={item.refDate}
              onPress={() =>
                router.push({
                  pathname: "/expense/add",
                  params: {
                    id: item.expense.id,
                    year: item.refDate.getFullYear(),
                    month: item.refDate.getMonth(),
                  },
                })
              }
            />
          )}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="pb-[140px]"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
