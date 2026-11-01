import React, { useMemo } from "react";
import { View, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import dayjs from "dayjs";
import { sortBy, sumBy } from "@/utils/collections";
import { useSetState } from "@/utils/useSetState";
import { useExpenses } from "@/context/ExpenseContext";
import { KpiRow } from "@/components/kpi/KpiRow";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { EmptyState } from "@/components/EmptyState";
import { type DayEntry } from "@/components/DayGroupedExpenseList";
import { ExpenseCard } from "@/components/ExpenseCard";
import { BandHeader } from "@/components/BandHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { cycleStateOn, effectivePaidDate, getDueDateForMonth, isOverdueOn, nextCycleDueDate } from "@/utils/dateHelpers";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { FeatherIconName } from "@/types";

interface Band {
  key: string;
  label: string;
  icon: FeatherIconName;
  accent: string;
  canOpenBillSheet: boolean; // rows still to pay open the bill sheet on tap
  total?: number;
  data: DayEntry[];
}

// Rank order. "Not due" holds plans with no cycle this month (not started, ended, or a yearly plan
// outside its month): listed so they stay easy to find, but never totalled.
const BANDS: Omit<Band, "total" | "data">[] = [
  { key: "overdue", label: "Overdue", icon: "alert-triangle", accent: colors.overdue, canOpenBillSheet: true },
  { key: "unpaid", label: "Unpaid", icon: "circle", accent: colors.secondary, canOpenBillSheet: true },
  { key: "paid", label: "Paid", icon: "check-circle", accent: colors.paid, canOpenBillSheet: false },
  { key: "not-due", label: "Not due", icon: "pause-circle", accent: colors.textMuted, canOpenBillSheet: false },
];
const NOT_DUE_RANK = 3;

export default function RecurringScreen() {
  const { expenses, loading, getMonthStatus, resolveAmount, getMonthPaidAt } = useExpenses();
  const refreshControl = useRefreshControl();
  const today = dayjs().startOf("day").toDate();
  const [{ year, month }, setSelected] = useSetState({ year: today.getFullYear(), month: today.getMonth() });

  const recurringExpenses = useMemo(
    () => expenses.filter((e) => e.recurrence !== "one-off"),
    [expenses]
  );

  const bands = useMemo<Band[]>(() => {
    const ranked = recurringExpenses.map((e) => {
      const refDate = new Date(year, month, 1);
      const amount = resolveAmount(e, year, month);
      const cycleState = cycleStateOn(e, year, month);
      if (cycleState !== "active") {
        // Upcoming plans by their next due date, then ended ones by when they ended.
        const nextDue = nextCycleDueDate(e, year, month);
        const endedAt = e.endYear != null && e.endMonth != null ? getDueDateForMonth(e.dueDay, e.endYear, e.endMonth) : refDate;
        const entry: DayEntry = { key: e.id, expense: e, effDate: nextDue ?? endedAt, refDate, amount };
        return { entry, rank: NOT_DUE_RANK, isEnded: nextDue == null };
      }
      const paidAt = getMonthPaidAt(e.id, year, month);
      const effDate = effectivePaidDate(paidAt, e.dueDay, year, month);

      const status = getMonthStatus(e.id, year, month);
      const overdue = status === "unpaid" && isOverdueOn(e.dueDay, year, month);
      // overdue → unpaid → paid
      const rank = overdue ? 0 : status === "unpaid" ? 1 : 2;

      const entry: DayEntry = { key: e.id, expense: e, effDate, refDate, amount };
      return { entry, rank, isEnded: false };
    });
    const sorted = sortBy(ranked, ["rank", "isEnded", (r) => r.entry.effDate]);
    return BANDS.map((band, rank) => {
      const data = sorted.filter((r) => r.rank === rank).map((r) => r.entry);
      return { ...band, data, total: rank === NOT_DUE_RANK ? undefined : sumBy(data, "amount") };
    }).filter((band) => band.data.length > 0);
  }, [recurringExpenses, getMonthStatus, resolveAmount, getMonthPaidAt, year, month]);

  const monthLabel = dayjs(new Date(year, month, 1)).format("MMMM YYYY");

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
        <PeriodNavigator
          year={year}
          month={month}
          onChange={(year, month) => setSelected({ year, month })}
        />
      </View>

      {recurringExpenses.length === 0 ? (
        <EmptyState onAdd={() => router.push("/expense/add?type=recurring")} />
      ) : (
        <SectionList<DayEntry, Band>
          sections={bands}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={<KpiRow year={year} month={month} recurringOnly />}
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
          renderItem={({ item, index, section }) => (
            <ExpenseCard
              expense={item.expense}
              index={index}
              referenceDate={item.refDate}
              canOpenBillSheet={section.canOpenBillSheet}
            />
          )}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="pb-[140px]"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}
    </SafeAreaView>
  );
}
