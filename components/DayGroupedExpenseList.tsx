import React, { useMemo } from "react";
import { SectionList } from "react-native";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { ActivityEntryRow } from "@/components/ActivityEntryRow";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { BillPaymentEntry, IncomeEntry, TransferEntry } from "@/utils/usePaidLedger";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";
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
export type ActivityEntry = LedgerEntry | IncomeEntry | TransferEntry | LoanActivityEntry;

interface DaySection {
  key: string;
  date: Date;
  total: number;
  data: ActivityEntry[];
}

interface Props {
  // Pre-sorted by the caller; section order = first-seen day order (insertion order),
  // so pass entries newest-first or soonest-first to control direction.
  entries: ActivityEntry[];
  // false → skip the per-day headers/subtotals and render one flat list; each card
  // shows its own date instead (recurring tab). Default true (paid ledger).
  grouped?: boolean;
  // false → day headers without subtotals (mixed in/out lists where a sum means nothing).
  showDayTotals?: boolean;
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
  refreshControl?: React.ComponentProps<typeof SectionList>["refreshControl"];
}

export function DayGroupedExpenseList({ entries, grouped = true, showDayTotals = true, ListHeaderComponent, ListEmptyComponent, refreshControl }: Props) {
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
      refreshControl={refreshControl}
      renderItem={({ item, index }) => <ActivityEntryRow item={item} index={index} />}
      renderSectionHeader={
        grouped
          ? ({ section }) => {
              const s = section as unknown as DaySection;
              return <DayHeaderRow date={s.date} total={showDayTotals ? s.total : undefined} />;
            }
          : undefined
      }
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
