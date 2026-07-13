import React, { useMemo } from "react";
import { View, Text, SectionList } from "react-native";
import { router } from "expo-router";
import dayjs from "dayjs";
import { ExpenseCard } from "./ExpenseCard";
import { formatAmount } from "../utils/dateHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

// A single row in a day-grouped list. `effDate` decides which day bucket it lands
// in (pay-date if paid, due-date if unpaid); `refDate` is the cycle month the card
// resolves its amount/status/edit-nav against. Same shape as PaidEntry (+ compact).
export interface DayEntry {
  key: string;
  expense: Expense;
  effDate: Date;
  refDate: Date;
  amount: number;
  compact?: boolean;
  hideDate?: boolean;
}

interface DaySection {
  key: string;
  date: Date;
  dayTotal: number;
  data: DayEntry[];
}

// Weekend accent: Sun red, Sat indigo, weekdays muted (mirrors the reference ledger).
function weekdayColor(date: Date): string {
  const d = dayjs(date).day();
  if (d === 0) return colors.overdue;
  if (d === 6) return colors.secondary;
  return colors.textMuted;
}

interface Props {
  // Pre-sorted by the caller; section order = first-seen day order (Map insertion),
  // so pass entries newest-first or soonest-first to control direction.
  entries: DayEntry[];
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
}

export function DayGroupedExpenseList({ entries, ListHeaderComponent, ListEmptyComponent }: Props) {
  const sections = useMemo(() => {
    const groups = new Map<string, DaySection>();
    for (const it of entries) {
      const key = dayjs(it.effDate).format("YYYY-MM-DD");
      let g = groups.get(key);
      if (!g) {
        g = { key, date: it.effDate, dayTotal: 0, data: [] };
        groups.set(key, g);
      }
      g.data.push(it);
      g.dayTotal += it.amount;
    }
    return [...groups.values()];
  }, [entries]);

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
        const s = section as unknown as DaySection;
        return (
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-white text-[22px] font-oswald-medium">
                {dayjs(s.date).format("D")}
              </Text>
              <Text
                className="text-[11px] font-quicksand-bold uppercase tracking-wider"
                style={{ color: weekdayColor(s.date) }}
              >
                {dayjs(s.date).format("ddd")}
              </Text>
              <Text className="text-white/30 text-[11px] font-quicksand-medium">
                {dayjs(s.date).format("MMM YYYY")}
              </Text>
            </View>
            <Text className="text-white/70 text-[13px] font-oswald-medium">
              {formatAmount(s.dayTotal)}
            </Text>
          </View>
        );
      }}
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
