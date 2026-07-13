import React, { useMemo } from "react";
import { View, Text, SectionList } from "react-native";
import { router } from "expo-router";
import dayjs from "dayjs";
import { Feather } from "@expo/vector-icons";
import { ExpenseCard } from "./ExpenseCard";
import { DayHeaderRow } from "./DayHeaderRow";
import { formatAmount } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { DayEntry } from "./DayGroupedExpenseList";
import type { FeatherIconName } from "../types";

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
  icon?: FeatherIconName;
  accent?: string;
  date: Date;
  total: number;
  data: DayEntry[];
};
type HomeSection = FlatSection | DaySection;

const sum = (arr: DayEntry[]) => arr.reduce((t, e) => t + e.amount, 0);

function BandHeader({
  label,
  icon,
  accent,
  total,
}: {
  label: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
}) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-4 pb-1.5">
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={13} color={accent} />
        <Text
          className="text-[11px] uppercase tracking-widest font-quicksand-bold"
          style={{ color: accent }}
        >
          {label}
        </Text>
      </View>
      <Text className="text-white/50 text-[12px] font-oswald-medium">{formatAmount(total)}</Text>
    </View>
  );
}

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
        total: sum(overdue),
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
        total: sum(upcoming),
        data: upcoming,
      });
    }

    if (recentlyPaid.length) {
      const groups = new Map<string, DaySection>();
      for (const it of recentlyPaid) {
        const k = dayjs(it.effDate).format("YYYY-MM-DD");
        let g = groups.get(k);
        if (!g) {
          g = { kind: "day", key: k, date: it.effDate, total: 0, data: [] };
          groups.set(k, g);
        }
        g.data.push(it);
        g.total += it.amount;
      }
      const days = [...groups.values()];
      days[0].band = "Recently Paid";
      days[0].bandTotal = sum(recentlyPaid);
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
          return <BandHeader label={s.band} icon={s.icon} accent={s.accent} total={s.total} />;
        }
        return (
          <View>
            {s.band ? (
              <BandHeader
                label={s.band}
                icon={s.icon ?? "check-circle"}
                accent={s.accent ?? colors.paid}
                total={s.bandTotal ?? 0}
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
