import React, { useMemo } from "react";
import { SectionList } from "react-native";
import { router } from "expo-router";
import { ExpenseCard } from "@/components/ExpenseCard";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { BillPaymentRow } from "@/components/accounts/BillPaymentRow";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { BillPaymentEntry } from "@/utils/usePaidLedger";
import type { Expense } from "@/types";

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

export type LedgerEntry = DayEntry | BillPaymentEntry;

interface DaySection {
  key: string;
  date: Date;
  total: number;
  data: LedgerEntry[];
}

interface Props {
  // Pre-sorted by the caller; section order = first-seen day order (insertion order),
  // so pass entries newest-first or soonest-first to control direction.
  entries: LedgerEntry[];
  // false → skip the per-day headers/subtotals and render one flat list; each card
  // shows its own date instead (recurring tab). Default true (paid ledger).
  grouped?: boolean;
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
}

export function DayGroupedExpenseList({ entries, grouped = true, ListHeaderComponent, ListEmptyComponent }: Props) {
  const sections = useMemo(() => {
    if (!grouped) {
      return [{ key: "all", date: entries[0]?.effDate ?? new Date(), total: 0, data: entries }];
    }
    return groupEntriesByDay(entries);
  }, [entries, grouped]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      renderItem={({ item, index }) =>
        "expense" in item ? (
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
        ) : (
          <BillPaymentRow entry={item} />
        )
      }
      renderSectionHeader={
        grouped
          ? ({ section }) => {
              const s = section as unknown as DaySection;
              return <DayHeaderRow date={s.date} total={s.total} />;
            }
          : undefined
      }
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
