import React, { useMemo } from "react";
import { View, SectionList } from "react-native";
import { router } from "expo-router";
import sumBy from "lodash/sumBy";
import { ExpenseCard } from "@/components/ExpenseCard";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { BandHeader } from "@/components/BandHeader";
import { colors } from "@/constants/theme";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { DayEntry } from "@/components/DayGroupedExpenseList";
import type { FeatherIconName } from "@/types";

// Home has three bands. Overdue + Upcoming are flat (each card shows its own date);
// Recently Paid mirrors the Expenses ledger — day-grouped (DayHeaderRow + subtotals),
// compact cards, with the "RECENTLY PAID" band label on the first day only.
type FlatSection = {
  kind: "flat";
  key: string;
  band: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
  data: DayEntry[];
};
type DaySection = {
  kind: "day";
  key: string;
  band?: string; // only the first paid day carries the band label
  bandTotal?: number;
  bandCount?: number;
  icon?: FeatherIconName;
  accent?: string;
  date: Date;
  total: number;
  data: DayEntry[];
};
type HomeSection = FlatSection | DaySection;

interface Props {
  overdue: DayEntry[];
  upcoming: DayEntry[];
  recentlyPaid: DayEntry[];
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
}

export function HomeExpenseSections({
  overdue,
  upcoming,
  recentlyPaid,
  ListHeaderComponent,
  ListEmptyComponent,
}: Props) {
  const sections = useMemo<HomeSection[]>(() => {
    const out: HomeSection[] = [];

    if (overdue.length) {
      out.push({
        kind: "flat",
        key: "overdue",
        band: "Overdue",
        icon: "alert-triangle",
        accent: colors.overdue,
        total: sumBy(overdue, "amount"),
        data: overdue,
      });
    }

    if (upcoming.length) {
      out.push({
        kind: "flat",
        key: "upcoming",
        band: "Upcoming",
        icon: "arrow-up-circle",
        accent: colors.secondary,
        total: sumBy(upcoming, "amount"),
        data: upcoming,
      });
    }

    if (recentlyPaid.length) {
      const days: DaySection[] = groupEntriesByDay(recentlyPaid).map((g) => ({ kind: "day", ...g }));
      days[0].band = "Recently Paid";
      days[0].bandTotal = sumBy(recentlyPaid, "amount");
      days[0].bandCount = recentlyPaid.length;
      days[0].icon = "check-circle";
      days[0].accent = colors.paid;
      out.push(...days);
    }

    return out;
  }, [overdue, upcoming, recentlyPaid]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      renderItem={({ item, index }) => (
        <ExpenseCard
          expense={item.expense}
          index={index}
          compact={item.compact}
          hideDate={item.hideDate}
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
      renderSectionHeader={({ section }) => {
        const s = section as unknown as HomeSection;
        if (s.kind === "flat") {
          return <BandHeader label={s.band} icon={s.icon} accent={s.accent} total={s.total} count={s.data.length} />;
        }
        return (
          <View>
            {s.band ? (
              <BandHeader
                label={s.band}
                icon={s.icon ?? "check-circle"}
                accent={s.accent ?? colors.paid}
                total={s.bandTotal ?? 0}
                count={s.bandCount}
              />
            ) : null}
            <DayHeaderRow date={s.date} total={s.total} />
          </View>
        );
      }}
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
