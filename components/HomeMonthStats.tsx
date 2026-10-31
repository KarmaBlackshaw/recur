import React from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AMOUNT_TONE, ICON_TONE, type RowTone } from "@/components/ui/AppListRow";
import { chunk } from "@/utils/collections";
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

interface Stat {
  label: string;
  value: number;
  icon: FeatherIconName;
  tone: RowTone;
  href: string;
  isShown: boolean;
}

function StatCell({ label, value, icon, tone: activeTone, href, hasDivider }: Stat & { hasDivider: boolean }) {
  const tone = value > 0 ? activeTone : "muted";
  const { tile, glyph } = ICON_TONE[tone];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.navigate(href)}
      className={`flex-1 flex-row items-center gap-3 px-4 py-3 ${hasDivider ? "border-l border-border" : ""}`}
    >
      <View className={`w-[36px] h-[36px] rounded-xl items-center justify-center ${tile}`}>
        <Feather name={icon} size={17} color={glyph} />
      </View>
      <View className="flex-1">
        <AppText variant="meta" numberOfLines={1}>
          {label}
        </AppText>
        <AppText
          variant="amount"
          className={AMOUNT_TONE[tone]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {formatAmount(value)}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}

export function HomeMonthStats({ year, month, feed, owed }: Props) {
  const { accounts } = useAccounts();
  const { paidTotal, moneyIn, chargedTotal } = useMonthActivity(feed, year, month);
  const hasCards = accounts.some((a) => a.type === "credit");
  const activityHref = (segment: ActivitySegment) => `/expenses?segment=${segment}&year=${year}&month=${month}`;

  const stats: Stat[] = [
    { label: "Spent", value: paidTotal, icon: "arrow-up-right", tone: "neutral", href: activityHref("paid"), isShown: true },
    { label: "Received", value: moneyIn, icon: "arrow-down-left", tone: "positive", href: activityHref("income"), isShown: true },
    { label: "Charged", value: chargedTotal, icon: "credit-card", tone: "accent", href: activityHref("charged"), isShown: hasCards },
    { label: "Owed to you", value: owed?.total ?? 0, icon: "users", tone: "accent", href: "/loans", isShown: owed != null },
  ];

  const rows = chunk(
    stats.filter(({ isShown }) => isShown),
    2
  );

  return (
    <View className="mx-5 mt-3 rounded-2xl border border-border bg-surface">
      {rows.map((row, rowIndex) => (
        <View key={row[0].label} className={`flex-row ${rowIndex > 0 ? "border-t border-border" : ""}`}>
          {row.map((stat, cellIndex) => (
            <StatCell key={stat.label} {...stat} hasDivider={cellIndex > 0} />
          ))}
        </View>
      ))}
    </View>
  );
}
