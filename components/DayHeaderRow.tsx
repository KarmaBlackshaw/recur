import React from "react";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import dayjs from "dayjs";
import { formatAmount } from "@/utils/dateHelpers";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";

// Weekends in periwinkle, weekdays muted. Coral stays reserved for "late".
export function weekdayColor(date: Date): string {
  const d = dayjs(date).day();
  if (d === 0 || d === 6) {
    return colors.secondary;
  }
  return colors.textMuted;
}

// The per-day header: big day number, colored weekday, month/year, right-aligned total.
// Shared by DayGroupedExpenseList (all day groups) and HomeExpenseSections (Upcoming).
export function DayHeaderRow({ date, total, isSigned = false }: { date: Date; total?: number; isSigned?: boolean }) {
  const isNetIn = isSigned && total != null && total > 0;
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
      {total != null && (
        <AppText variant="amount-sm" className={isNetIn ? "text-paid" : ""}>
          {isSigned ? `${isNetIn ? "+" : ""}${signedAmount(total)}` : formatAmount(total)}
        </AppText>
      )}
    </View>
  );
}
