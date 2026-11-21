import React from "react";
import { SectionList, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { AppHeroCard } from "@/components/ui/AppHeroCard";
import { AppLineChart } from "@/components/ui/AppLineChart";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppText } from "@/components/ui/AppText";
import { LoadingState } from "@/components/ui/LoadingState";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { signedAmount } from "@/utils/signedAmount";
import { formatShortDate } from "@/utils/dates/formatShortDate";
import { countLabel } from "@/utils/countLabel";
import { useForecast } from "@/utils/forecast/useForecast";
import type { ForecastLine } from "@/utils/forecast/projectLine";
import type { ForecastOutflow } from "@/utils/forecast/forecastOutflows";
import type { Account, FeatherIconName, TOption } from "@/types";

const HORIZONS: TOption<number>[] = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

const CHART_HEIGHT = 120;
// The chart sits inside the hero card, which sits inside the page's side margins.
const CHART_SIDE_SPACE = 80;

const ACCOUNT_ICON: Record<"debit" | "cash", FeatherIconName> = {
  debit: "credit-card",
  cash: "dollar-sign",
};

type ForecastItem =
  | { kind: "account"; key: string; line: ForecastLine & { account: Account } }
  | { kind: "bill"; key: string; outflow: ForecastOutflow };

// Route params arrive as free text: anything but 60 or 90 falls back to 30 days.
function parseHorizon(value: string | undefined): number {
  return HORIZONS.find((h) => String(h.value) === value)?.value ?? HORIZONS[0].value;
}

export default function ForecastScreen() {
  const { loading } = useExpenses();
  const { activeAccounts } = useAccounts();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ days?: string }>();
  const days = parseHorizon(params.days);
  const { total, accounts, outflows, unknownCount, today } = useForecast(days);
  const accountName = (id: string | null) => activeAccounts.find((a) => a.id === id)?.name;

  const isToday = (date: Date) => dayjs(date).isSame(today, "day");
  const dayLabel = (date: Date) => (isToday(date) ? "Today" : formatShortDate(date));
  const fromLabel = (date: Date) => (isToday(date) ? "from today" : `from ${formatShortDate(date)}`);
  const lowestWhen = isToday(total.lowestOn) ? "today" : `on ${formatShortDate(total.lowestOn)}`;
  const thresholdNote = total.belowOn
    ? `Under ${formatAmount(total.threshold)} ${fromLabel(total.belowOn)}`
    : `Stays above ${formatAmount(total.threshold)}`;
  const lowestIndex = total.values.indexOf(total.lowest);

  const sections = [
    {
      title: "Accounts",
      data: accounts.map((line): ForecastItem => ({ kind: "account", key: line.account.id, line })),
    },
    {
      title: `Bills ahead · ${countLabel(outflows.length, "bill", "bills")}`,
      data: outflows.map((outflow): ForecastItem => ({ kind: "bill", key: outflow.key, outflow })),
    },
  ].filter(({ data }) => data.length > 0);

  function renderItem({ item }: { item: ForecastItem }) {
    if (item.kind === "account") {
      const { account, lowest, lowestOn, belowOn, threshold, start } = item.line;
      const isBelow = belowOn != null;
      const amount = signedAmount(lowest);
      const caption = isBelow ? `Under ${formatAmount(threshold)} ${fromLabel(belowOn)}` : `Now ${signedAmount(start)}`;
      return (
        <AppListRow
          icon={ACCOUNT_ICON[account.type === "cash" ? "cash" : "debit"]}
          iconTone={isBelow ? "negative" : "neutral"}
          title={account.name}
          meta={`Lowest ${dayLabel(lowestOn)}`}
          amount={amount}
          amountTone={isBelow ? "negative" : "neutral"}
          caption={caption}
          captionTone={isBelow ? "negative" : "neutral"}
          accessory="chevron-right"
          onPress={() => router.push({ pathname: "/account/[id]", params: { id: account.id } })}
          accessibilityLabel={`${account.name}, lowest ${amount} ${dayLabel(lowestOn)}, ${caption}`}
        />
      );
    }
    const { outflow } = item;
    const card = outflow.cardId && outflow.cardId !== outflow.accountId ? accountName(outflow.cardId) : undefined;
    const isCardCharge = card != null && card !== outflow.name;
    const meta = [outflow.isOverdue ? "Overdue" : dayLabel(outflow.date), isCardCharge ? `on ${card}` : null]
      .filter(Boolean)
      .join(" · ");
    const caption = accountName(outflow.accountId) ?? "Total only";
    const amount = formatAmount(outflow.amount);
    return (
      <AppListRow
        icon={outflow.cardId ? "credit-card" : "repeat"}
        iconTone={outflow.isOverdue ? "negative" : "neutral"}
        title={outflow.name}
        meta={meta}
        amount={amount}
        caption={caption}
        captionTone={outflow.accountId ? "neutral" : "muted"}
        accessibilityLabel={`${outflow.name}, ${amount}, ${meta}, from ${caption}`}
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center pl-3 pr-2 pt-2 pb-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="title" className="flex-1" numberOfLines={1}>
          Forecast
        </AppText>
      </View>

      <AppTabs tabs={HORIZONS} value={days} onChange={(value) => router.setParams({ days: String(value) })} className="mx-5 mt-1" />

      <SectionList
        sections={sections}
        keyExtractor={({ key }) => key}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-5"
        ListHeaderComponent={
          <AppHeroCard
            overline="Lowest point"
            value={signedAmount(total.lowest)}
            tone="secondary"
            isNegative={total.belowOn != null}
            className="mx-5 mt-3 mb-1"
          >
            <AppText variant="meta" className="mt-1">
              {`Debit and cash, ${lowestWhen} · now ${signedAmount(total.start)}`}
            </AppText>
            <AppText variant="meta" className={total.belowOn ? "text-overdue" : undefined}>
              {thresholdNote}
            </AppText>
            <View className="mt-4" accessible accessibilityLabel={`Balance chart for the next ${days} days`}>
              <AppLineChart
                values={total.values}
                width={width - CHART_SIDE_SPACE}
                height={CHART_HEIGHT}
                color={colors.secondary}
                reference={{ value: total.threshold, color: colors.overdue }}
                markIndex={lowestIndex}
                markColor={total.belowOn ? colors.overdue : colors.secondary}
              />
              <View className="mt-1 flex-row justify-between">
                <AppText variant="meta">Today</AppText>
                <AppText variant="meta">{formatShortDate(dayjs(today).add(days, "day").toDate())}</AppText>
              </View>
            </View>
          </AppHeroCard>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="meta" className="px-5 pt-4 pb-1 text-textMuted" accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={renderItem}
        ListFooterComponent={
          <View className="px-5 pt-4 gap-1">
            {outflows.length === 0 && (
              <AppText variant="meta" className="text-textMuted">
                {`No bills due in the next ${days} days`}
              </AppText>
            )}
            {unknownCount > 0 && (
              <AppText variant="meta" className="text-textMuted">
                {`${countLabel(unknownCount, "bill", "bills")} without an amount yet aren't counted`}
              </AppText>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
