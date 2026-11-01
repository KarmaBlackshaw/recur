import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { router } from "expo-router";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AMOUNT_TONE, ICON_TONE } from "@/components/ui/AppListRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { useMonthActivity } from "@/utils/useMonthActivity";
import type { ActivityFeed } from "@/utils/useActivityFeed";
import type { OwedToYou } from "@/utils/useOwedToYou";
import type { ActivitySegment, FeatherIconName } from "@/types";

interface Props {
  year: number;
  month: number;
  feed: ActivityFeed;
  owed: OwedToYou | null;
}

interface LinkRow {
  label: string;
  value: number;
  icon: FeatherIconName;
  href: string;
  isShown: boolean;
}

function FigureLabel({ children }: { children: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <AppText variant="overline" numberOfLines={1} className="shrink">
        {children}
      </AppText>
      <Feather name="chevron-right" size={12} color={colors.textMuted} />
    </View>
  );
}

export function HomeMonthStats({ year, month, feed, owed }: Props) {
  const { accounts } = useAccounts();
  const { paidTotal, moneyIn, chargedTotal } = useMonthActivity(feed, year, month);
  const hasCards = accounts.some((a) => a.type === "credit");
  const monthName = dayjs(new Date(year, month, 1)).format("MMMM");
  const isQuiet = paidTotal === 0 && moneyIn === 0 && chargedTotal === 0;
  const activityHref = (segment: ActivitySegment) => `/expenses?segment=${segment}&year=${year}&month=${month}`;

  const linkRows: LinkRow[] = [
    {
      label: "Charged",
      value: chargedTotal,
      icon: "credit-card",
      href: activityHref("charged"),
      isShown: hasCards && chargedTotal > 0,
    },
    {
      label: "Owed to you",
      value: owed?.total ?? 0,
      icon: "users",
      href: "/loans?segment=active",
      isShown: owed != null,
    },
  ];

  return (
    <View className="mx-5 mt-3 rounded-2xl border border-border bg-surface">
      {isQuiet ? (
        <View className="px-5 pt-4 pb-3">
          <AppText variant="overline">{monthName}</AppText>
          <AppText variant="body-medium" className="mt-1 text-[14px] text-textSecondary">
            Nothing spent or received yet
          </AppText>
        </View>
      ) : (
        <View className="flex-row">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.navigate(activityHref("paid"))}
            className="flex-1 pl-5 pr-3 pt-4 pb-3"
          >
            <FigureLabel>{`Spent in ${monthName}`}</FigureLabel>
            <Text
              className={`mt-1 text-[32px] font-oswald-medium ${AMOUNT_TONE[paidTotal > 0 ? "neutral" : "muted"]}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.4}
            >
              {formatAmount(paidTotal)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.navigate(activityHref("income"))}
            className="shrink-0 items-end pl-3 pr-5 pt-4 pb-3"
          >
            <FigureLabel>Received</FigureLabel>
            <AppText
              variant="amount"
              numberOfLines={1}
              className={`mt-1 ${AMOUNT_TONE[moneyIn > 0 ? "positive" : "muted"]}`}
            >
              {formatAmount(moneyIn)}
            </AppText>
          </TouchableOpacity>
        </View>
      )}
      {linkRows
        .filter(({ isShown }) => isShown)
        .map(({ label, value, icon, href }) => (
          <TouchableOpacity
            key={label}
            activeOpacity={0.7}
            onPress={() => router.navigate(href)}
            className="min-h-[44px] flex-row items-center border-t border-border px-5"
          >
            <Feather name={icon} size={16} color={ICON_TONE.accent.glyph} />
            <AppText variant="body-bold" className="ml-3 flex-1 text-sm text-white">
              {label}
            </AppText>
            <AppText variant="amount" numberOfLines={1} className={`mr-2 ${AMOUNT_TONE.accent}`}>
              {formatAmount(value)}
            </AppText>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
    </View>
  );
}
