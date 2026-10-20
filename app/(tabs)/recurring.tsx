import React, { useMemo } from "react";
import { View, SectionList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import dayjs from "dayjs";
import sortBy from "lodash/sortBy";
import sumBy from "lodash/sumBy";
import useSetState from "ahooks/es/useSetState";
import { useExpenses } from "@/context/ExpenseContext";
import { KpiRow } from "@/components/kpi/KpiRow";
import { MonthNavigator } from "@/components/MonthNavigator";
import { EmptyState } from "@/components/EmptyState";
import { type DayEntry } from "@/components/DayGroupedExpenseList";
import { ExpenseCard } from "@/components/ExpenseCard";
import { BandHeader } from "@/components/BandHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { effectivePaidDate, isOverdueOn } from "@/utils/dateHelpers";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { FeatherIconName } from "@/types";

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
      const paidAt = getMonthPaidAt(e.id, year, month);
      const effDate = effectivePaidDate(paidAt, e.dueDay, year, month);
      const refDate = new Date(year, month, 1);
      const amount = resolveAmount(e, year, month);

      const status = getMonthStatus(e.id, year, month);
      const overdue = status === "unpaid" && isOverdueOn(e.dueDay, year, month);
      // overdue → unpaid → paid
      const rank = overdue ? 0 : status === "unpaid" ? 1 : 2;

      const entry: DayEntry = { key: e.id, expense: e, effDate, refDate, amount };
      return { entry, rank };
    });
    const sorted = sortBy(ranked, ["rank", (r) => r.entry.effDate]);
    return BANDS.map((band, rank) => {
      const data = sorted.filter((r) => r.rank === rank).map((r) => r.entry);
      return { ...band, data, total: sumBy(data, "amount") };
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
        <MonthNavigator
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
          refreshControl={refreshControl}
        />
      )}
    </SafeAreaView>
  );
}
