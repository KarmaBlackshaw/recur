import React from "react";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import dayjs from "dayjs";
import { formatAmount } from "@/utils/dateHelpers";
import { colors } from "@/constants/theme";

// Weekend accent: Sun red, Sat indigo, weekdays muted (mirrors the reference ledger).
export function weekdayColor(date: Date): string {
  const d = dayjs(date).day();
  if (d === 0) {
    return colors.overdue;
  }
  if (d === 6) {
    return colors.secondary;
  }
  return colors.textMuted;
}

// The per-day header: big day number, colored weekday, month/year, right-aligned total.
// Shared by DayGroupedExpenseList (all day groups) and HomeExpenseSections (Upcoming).
export function DayHeaderRow({ date, total }: { date: Date; total: number }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
      <View className="flex-row items-baseline gap-2">
        <AppText variant="title">{dayjs(date).format("D")}</AppText>
        <AppText
          variant="overline"
          className="tracking-wider"
          style={{ color: weekdayColor(date) }}
        >
          {dayjs(date).format("ddd")}
        </AppText>
        <AppText variant="meta" className="text-textMuted">
          {dayjs(date).format("MMM YYYY")}
        </AppText>
      </View>
      <AppText variant="amount-sm">{formatAmount(total)}</AppText>
    </View>
  );
}
