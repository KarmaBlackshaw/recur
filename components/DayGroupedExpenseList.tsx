import React, { useEffect, useMemo, useRef } from "react";
import { SectionList } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { ActivityEntryRow } from "@/components/ActivityEntryRow";
import { TransferSheet, type TransferSheetRef } from "@/components/accounts/TransferSheet";
import { LoanSheet, type LoanSheetRef } from "@/components/loans/LoanSheet";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import { dayTotalOf } from "@/utils/activity/dayTotalOf";
import type { BillPaymentEntry, IncomeEntry, InterestEntry, TransferEntry } from "@/utils/usePaidLedger";
import type { LoanActivityEntry } from "@/utils/useLoanActivity";
import type { AccountTransaction, Expense } from "@/types";

// A single row in a day-grouped list. `effDate` decides which day bucket it lands
// in (pay-date if paid, due-date if unpaid); `refDate` is the cycle month the card
// resolves its amount/status/edit-nav against. Same shape as PaidEntry (+ compact).
export interface DayEntry {
  kind: "expense";
  key: string;
  expense: Expense;
  effDate: Date;
  refDate: Date;
  amount: number;
  isCard?: boolean;
  compact?: boolean;
  hideDate?: boolean;
  canOpenBillSheet?: boolean;  // unpaid due rows open the bill sheet on tap (Home)
  isSwipeHintShown?: boolean;  // this row peeks its Pay swipe once
  paidTxn?: AccountTransaction;
}

export type LedgerEntry = DayEntry | BillPaymentEntry;
export type ActivityEntry = LedgerEntry | IncomeEntry | InterestEntry | TransferEntry | LoanActivityEntry;

// "sum" adds the day's amounts (lists that only go one way). A flow function signs each row instead (money in +,
// out −, 0 when it doesn't count) and the header shows the day's net, or nothing when no row counts.
export type DayTotal = "sum" | "none" | ((entry: ActivityEntry) => number);

const SWIPE_GESTURE_REENABLE_DELAY_MS = 300;

interface DaySection {
  key: string;
  date: Date;
  total: number | undefined;
  data: ActivityEntry[];
}

interface Props {
  // Pre-sorted by the caller; section order = first-seen day order (insertion order),
  // so pass entries newest-first or soonest-first to control direction.
  entries: ActivityEntry[];
  // false → skip the per-day headers/subtotals and render one flat list; each card
  // shows its own date instead (recurring tab). Default true (paid ledger).
  grouped?: boolean;
  dayTotal?: DayTotal;
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
  refreshControl?: React.ComponentProps<typeof SectionList>["refreshControl"];
}

export function DayGroupedExpenseList({ entries, grouped = true, dayTotal = "sum", ListHeaderComponent, ListEmptyComponent, refreshControl }: Props) {
  const transferSheetRef = useRef<TransferSheetRef>(null);
  const loanSheetRef = useRef<LoanSheetRef>(null);
  const swipeGesturesEnabled = useSharedValue(true);
  const swipeReenableTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (swipeReenableTimeout.current != null) {
        clearTimeout(swipeReenableTimeout.current);
      }
    };
  }, []);

  const sections = useMemo<DaySection[]>(() => {
    if (!grouped) {
      return [{ key: "all", date: entries[0]?.effDate ?? new Date(), total: undefined, data: entries }];
    }
    return groupEntriesByDay(entries).map((day) => ({ ...day, total: dayTotalOf(day.data, dayTotal) }));
  }, [entries, grouped, dayTotal]);

  function clearSwipeReenableTimeout() {
    if (swipeReenableTimeout.current != null) {
      clearTimeout(swipeReenableTimeout.current);
      swipeReenableTimeout.current = null;
    }
  }

  function disableSwipeGestures() {
    clearSwipeReenableTimeout();
    swipeGesturesEnabled.value = false;
  }

  function enableSwipeGestures() {
    clearSwipeReenableTimeout();
    swipeGesturesEnabled.value = true;
  }

  function scheduleSwipeReenable() {
    clearSwipeReenableTimeout();
    swipeReenableTimeout.current = setTimeout(() => {
      swipeGesturesEnabled.value = true;
      swipeReenableTimeout.current = null;
    }, SWIPE_GESTURE_REENABLE_DELAY_MS);
  }

  return (
    <>
      <SectionList
        sections={sections}
        windowSize={7}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={refreshControl}
        onScrollBeginDrag={disableSwipeGestures}
        onScrollEndDrag={scheduleSwipeReenable}
        onMomentumScrollBegin={disableSwipeGestures}
        onMomentumScrollEnd={enableSwipeGestures}
        renderItem={({ item, index }) => (
          <ActivityEntryRow
            item={item}
            index={index}
            swipeEnabled={swipeGesturesEnabled}
            onOpenTransfer={(transfer) => transferSheetRef.current?.present(transfer)}
            onOpenLoan={(txn) => loanSheetRef.current?.present(txn)}
          />
        )}
        renderSectionHeader={
          grouped
            ? ({ section }) => {
                const s = section as unknown as DaySection;
                return <DayHeaderRow date={s.date} total={s.total} isSigned={typeof dayTotal === "function"} />;
              }
            : undefined
        }
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[140px]"
        showsVerticalScrollIndicator={false}
      />
      <TransferSheet ref={transferSheetRef} />
      <LoanSheet ref={loanSheetRef} />
    </>
  );
}
