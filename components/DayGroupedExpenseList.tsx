import React, { useMemo } from "react";
import { SectionList } from "react-native";
import { router } from "expo-router";
import dayjs from "dayjs";
import { ExpenseCard } from "./ExpenseCard";
import { DayHeaderRow } from "./DayHeaderRow";
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

interface Props {
  // Pre-sorted by the caller; section order = first-seen day order (Map insertion),
  // so pass entries newest-first or soonest-first to control direction.
  entries: DayEntry[];
  // false → skip the per-day headers/subtotals and render one flat list; each card
  // shows its own date instead (recurring tab). Default true (paid ledger).
  grouped?: boolean;
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
}

export function DayGroupedExpenseList({ entries, grouped = true, ListHeaderComponent, ListEmptyComponent }: Props) {
  const sections = useMemo(() => {
    if (!grouped) {
      return [{ key: "all", date: entries[0]?.effDate ?? new Date(), dayTotal: 0, data: entries }];
    }
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
  }, [entries, grouped]);

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
      renderSectionHeader={
        grouped
          ? ({ section }) => {
              const s = section as unknown as DaySection;
              return <DayHeaderRow date={s.date} total={s.dayTotal} />;
            }
          : undefined
      }
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
