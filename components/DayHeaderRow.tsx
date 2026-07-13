import React from "react";
import { View, Text } from "react-native";
import dayjs from "dayjs";
import { formatAmount } from "../utils/dateHelpers";
import { colors } from "../constants/theme";

// Weekend accent: Sun red, Sat indigo, weekdays muted (mirrors the reference ledger).
export function weekdayColor(date: Date): string {
  const d = dayjs(date).day();
  if (d === 0) return colors.overdue;
  if (d === 6) return colors.secondary;
  return colors.textMuted;
}

// The per-day header: big day number, colored weekday, month/year, right-aligned total.
// Shared by DayGroupedExpenseList (all day groups) and HomeExpenseSections (Upcoming).
export function DayHeaderRow({ date, total }: { date: Date; total: number }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-white text-[22px] font-oswald-medium">
          {dayjs(date).format("D")}
        </Text>
        <Text
          className="text-[11px] font-quicksand-bold uppercase tracking-wider"
          style={{ color: weekdayColor(date) }}
        >
          {dayjs(date).format("ddd")}
        </Text>
        <Text className="text-white/30 text-[11px] font-quicksand-medium">
          {dayjs(date).format("MMM YYYY")}
        </Text>
      </View>
      <Text className="text-white/70 text-[13px] font-oswald-medium">
        {formatAmount(total)}
      </Text>
    </View>
  );
}
