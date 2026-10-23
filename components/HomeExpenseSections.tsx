import React, { useMemo, useRef } from "react";
import { View, SectionList } from "react-native";
import sumBy from "lodash/sumBy";
import { CardBillRow } from "@/components/accounts/CardBillRow";
import { CardBillSheet, type CardBillSheetRef } from "@/components/accounts/CardBillSheet";
import { ActivityEntryRow } from "@/components/ActivityEntryRow";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { BandHeader } from "@/components/BandHeader";
import { colors } from "@/constants/theme";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { ActivityEntry, LedgerEntry } from "@/components/DayGroupedExpenseList";
import type { CardBill, FeatherIconName } from "@/types";

export type BillEntry = { key: string; bill: CardBill; effDate: Date; amount: number };
export type HomeEntry = LedgerEntry | BillEntry;
export type UpcomingBand = { key: string; label: string; caption: string; total: number; data: HomeEntry[] };

// Home has three kinds of band. Overdue + Upcoming (this month, and next month when it's near) are flat (each card shows its own date);
// Recent activity mirrors the Activity tab's All list — day-grouped, no subtotals
// (it mixes money in and out), with the band label on the first day only.
type FlatSection = {
  kind: "flat";
  key: string;
  band: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
  count?: number;
  caption?: string;
  data: HomeEntry[];
};
type DaySection = {
  kind: "day";
  key: string;
  band?: string; // only the first day carries the band label
  bandCount?: number;
  date: Date;
  total: number;
  data: ActivityEntry[];
};
type HomeSection = FlatSection | DaySection;

interface Props {
  overdue: HomeEntry[];
  upcoming: UpcomingBand[];
  recentActivity: ActivityEntry[];
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
  refreshControl?: React.ComponentProps<typeof SectionList>["refreshControl"];
}

export function HomeExpenseSections({
  overdue,
  upcoming,
  recentActivity,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
}: Props) {
  const billSheetRef = useRef<CardBillSheetRef>(null);
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
        count: overdue.length,
        data: overdue,
      });
    }

    for (const { key, label, caption, total, data } of upcoming) {
      out.push({ kind: "flat", key, band: label, caption, icon: "arrow-up-circle", accent: colors.secondary, total, data });
    }

    if (recentActivity.length) {
      const days: DaySection[] = groupEntriesByDay(recentActivity).map((g) => ({ kind: "day", ...g }));
      days[0].band = "Recent activity";
      days[0].bandCount = recentActivity.length;
      out.push(...days);
    }

    return out;
  }, [overdue, upcoming, recentActivity]);

  return (
    <>
      <SectionList<HomeEntry | ActivityEntry, HomeSection>
        sections={sections}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={refreshControl}
        renderItem={({ item, index }) =>
          "bill" in item ? (
            <CardBillRow bill={item.bill} onPress={() => billSheetRef.current?.present(item.bill)} />
          ) : (
            <ActivityEntryRow item={item} index={index} />
          )
        }
        renderSectionHeader={({ section }) => {
          const s = section as unknown as HomeSection;
          if (s.kind === "flat") {
            return <BandHeader label={s.band} icon={s.icon} accent={s.accent} total={s.total} count={s.count} caption={s.caption} />;
          }
          return (
            <View>
              {s.band ? (
                <BandHeader label={s.band} icon="activity" accent={colors.textSecondary} count={s.bandCount} />
              ) : null}
              <DayHeaderRow date={s.date} />
            </View>
          );
        }}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[140px]"
        showsVerticalScrollIndicator={false}
      />
      <CardBillSheet ref={billSheetRef} />
    </>
  );
}
