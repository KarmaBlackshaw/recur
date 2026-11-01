import React, { useMemo, useRef } from "react";
import { View, SectionList, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { sumBy } from "@/utils/collections";
import { CardBillRow } from "@/components/accounts/CardBillRow";
import { CardBillSheet, type CardBillSheetRef } from "@/components/accounts/CardBillSheet";
import { TransferSheet, type TransferSheetRef } from "@/components/accounts/TransferSheet";
import { LoanSheet, type LoanSheetRef } from "@/components/loans/LoanSheet";
import { ActivityEntryRow } from "@/components/ActivityEntryRow";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { BandHeader } from "@/components/BandHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { ActivityEntry, LedgerEntry } from "@/components/DayGroupedExpenseList";
import type { CardBill, FeatherIconName, HomeBandSlot } from "@/types";

export type BillEntry = { key: string; bill: CardBill; effDate: Date; amount: number };
export type HomeEntry = LedgerEntry | BillEntry;
export type UpcomingBand = {
  key: string;
  slot: HomeBandSlot;
  label: string;
  caption: string;
  total: number;
  data: HomeEntry[];
};

// A link row under a section, e.g. "All activity".
type SectionFooter = { label: string; onPress: () => void };

// Home has two kinds of band. Overdue + Upcoming (this month, and next month when it's near) are flat (each row shows its own date);
// Recent activity mirrors the Activity tab's All list — day-grouped, each day showing its signed net,
// with the band label on the first day only.
type FlatSection = {
  kind: "flat";
  key: string;
  band: string;
  icon: FeatherIconName;
  accent: string;
  total: number;
  count?: number;
  caption?: string;
  slot?: HomeBandSlot;
  isCollapsed?: boolean;
  footer?: SectionFooter;
  data: HomeEntry[];
};
type DaySection = {
  kind: "day";
  key: string;
  band?: string; // only the first day carries the band label
  bandCount?: number;
  date: Date;
  total: number | undefined;
  footer?: SectionFooter;
  data: ActivityEntry[];
};
type HomeSection = FlatSection | DaySection;

interface Props {
  overdue: HomeEntry[];
  upcoming: UpcomingBand[];
  recentActivity: ActivityEntry[];
  // Keyed like groupEntriesByDay (YYYY-MM-DD).
  recentDayNets: Record<string, number | undefined>;
  collapsedSlots: HomeBandSlot[];
  onToggleSlot: (slot: HomeBandSlot) => void;
  ListHeaderComponent?: React.ComponentProps<typeof SectionList>["ListHeaderComponent"];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
  refreshControl?: React.ComponentProps<typeof SectionList>["refreshControl"];
}

function FooterLink({ label, onPress }: SectionFooter) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between px-5 min-h-[44px]"
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <AppText variant="body-bold" className="text-[13px] text-secondary">
        {label}
      </AppText>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function HomeExpenseSections({
  overdue,
  upcoming,
  recentActivity,
  recentDayNets,
  collapsedSlots,
  onToggleSlot,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
}: Props) {
  const billSheetRef = useRef<CardBillSheetRef>(null);
  const transferSheetRef = useRef<TransferSheetRef>(null);
  const loanSheetRef = useRef<LoanSheetRef>(null);
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

    for (const { key, slot, label, caption, total, data } of upcoming) {
      const isCollapsed = collapsedSlots.includes(slot);
      out.push({
        kind: "flat",
        key,
        band: label,
        caption,
        icon: "arrow-up-circle",
        accent: colors.secondary,
        total,
        slot,
        isCollapsed,
        data: isCollapsed ? [] : data,
      });
    }

    if (recentActivity.length) {
      const days: DaySection[] = groupEntriesByDay(recentActivity).map((g) => ({
        kind: "day",
        ...g,
        total: recentDayNets[g.key],
      }));
      days[0].band = "Recent activity";
      days[0].bandCount = recentActivity.length;
      days[days.length - 1].footer = { label: "All activity", onPress: () => router.navigate("/expenses") };
      out.push(...days);
    }

    return out;
  }, [overdue, upcoming, recentActivity, recentDayNets, collapsedSlots]);

  function openCardBill(bill: CardBill) {
    billSheetRef.current?.present(bill, (dismiss) => (
      <AppButton
        label="Details"
        variant="tonal"
        onPress={() => {
          dismiss();
          router.push({ pathname: "/account/[id]", params: { id: bill.account.id } });
        }}
      />
    ));
  }

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
            <CardBillRow bill={item.bill} onPress={() => openCardBill(item.bill)} />
          ) : (
            <ActivityEntryRow
              item={item}
              index={index}
              onOpenTransfer={(transfer) => transferSheetRef.current?.present(transfer)}
              onOpenLoan={(txn) => loanSheetRef.current?.present(txn)}
            />
          )
        }
        renderSectionHeader={({ section }) => {
          const s = section as unknown as HomeSection;
          if (s.kind === "flat") {
            const { slot } = s;
            return (
              <BandHeader
                label={s.band}
                icon={s.icon}
                accent={s.accent}
                total={s.total}
                count={s.count}
                caption={s.caption}
                isCollapsed={s.isCollapsed}
                onToggle={slot ? () => onToggleSlot(slot) : undefined}
              />
            );
          }
          return (
            <View>
              {s.band ? (
                <BandHeader label={s.band} icon="activity" accent={colors.textSecondary} count={s.bandCount} />
              ) : null}
              <DayHeaderRow date={s.date} total={s.total} isSigned />
            </View>
          );
        }}
        renderSectionFooter={({ section }) => {
          const { footer } = section as unknown as HomeSection;
          return footer ? <FooterLink label={footer.label} onPress={footer.onPress} /> : null;
        }}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[140px]"
        showsVerticalScrollIndicator={false}
      />
      <CardBillSheet ref={billSheetRef} />
      <TransferSheet ref={transferSheetRef} />
      <LoanSheet ref={loanSheetRef} />
    </>
  );
}
