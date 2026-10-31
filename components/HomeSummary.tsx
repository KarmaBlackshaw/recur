import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { AppText } from "@/components/ui/AppText";
import { formatAmount } from "@/utils/dateHelpers";
import { useMonthTotals } from "@/utils/useMonthTotals";

interface Props {
  year: number;
  month: number;
  overdueCount: number;
  dueThisWeekCount: number;
}

// Home's answer to "what do I still owe this month": the amount left, a paid-vs-total bar and what's most urgent.
export function HomeSummary({ year, month, overdueCount, dueThisWeekCount }: Props) {
  const { total, paid, unpaid, charged } = useMonthTotals(year, month);
  const ratio = total > 0 ? Math.min(Math.max(paid / total, 0), 1) : 0;
  const percent = Math.round(ratio * 100);
  const unpaidText = formatAmount(unpaid);
  const spentText = `${formatAmount(paid)} of ${formatAmount(total)} spent`;
  const statusText =
    overdueCount > 0
      ? `${overdueCount} overdue`
      : dueThisWeekCount > 0
        ? `${dueThisWeekCount} due this week`
        : "Nothing due this week";
  const chargedText = charged > 0 ? `${formatAmount(charged)} charged to cards` : null;
  const accessibilityLabel = [
    `${unpaidText} left to pay this month`,
    `${spentText}, ${percent} percent paid`,
    statusText,
    chargedText,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <TouchableOpacity
      className="mx-5 mt-1 rounded-2xl border border-border bg-surface px-4 py-4"
      activeOpacity={0.85}
      onPress={() => router.navigate("/recurring")}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens Recurring"
    >
      <Text
        className="text-[32px] font-oswald-medium text-white"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.4}
      >
        {unpaidText}
      </Text>
      <AppText variant="meta">left to pay this month</AppText>
      <View className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden mt-3">
        <View className="h-full rounded-full bg-paid" style={{ width: `${percent}%` }} />
      </View>
      <AppText variant="meta" className="mt-2">
        {spentText}
      </AppText>
      <AppText variant="meta" className={overdueCount > 0 ? "text-overdue" : ""}>
        {statusText}
      </AppText>
      {chargedText ? <AppText variant="meta">{chargedText}</AppText> : null}
    </TouchableOpacity>
  );
}
