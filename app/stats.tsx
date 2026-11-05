import React, { useMemo } from "react";
import { FlatList, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { sumBy } from "@/utils/collections";
import { useExpenses } from "@/context/ExpenseContext";
import { EmptyState } from "@/components/EmptyState";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { AppDonutChart } from "@/components/ui/AppDonutChart";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppText } from "@/components/ui/AppText";
import { AppUnderlineTabs, type TUnderlineTab } from "@/components/ui/AppUnderlineTabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { chartHues, chartRest, colors } from "@/constants/theme";
import { parseMoneyFlow, parsePeriod, PERIODS } from "@/constants/periods";
import { categoryRows } from "@/utils/activity/categoryLine";
import { countLabel } from "@/utils/countLabel";
import { isInPeriod } from "@/utils/dateHelpers";
import { formatAmount } from "@/utils/formatAmount";
import type { TCategorySpend } from "@/utils/stats/categoryBreakdown";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { useSetState } from "@/utils/useSetState";
import type { FeatherIconName, MoneyFlow, Period } from "@/types";

const COPY: Record<MoneyFlow, { overline: string; emptyTitle: string; emptyIcon: FeatherIconName; emptyMessage: string }> = {
  income: { overline: "Received", emptyTitle: "No income", emptyIcon: "arrow-down-left", emptyMessage: "No income in" },
  expenses: { overline: "Spent", emptyTitle: "Nothing spent", emptyIcon: "pie-chart", emptyMessage: "No expenses in" },
};

const OTHER_SEGMENT_KEY = "other-categories";
const DONUT_RADIUS_RATIO = 0.22;
const DONUT_THICKNESS_RATIO = 0.3;

function shareLabel(share: number) {
  const percent = Math.round(share * 100);
  if (percent < 1) {
    return "<1%";
  }
  return percent === 100 && share < 1 ? ">99%" : `${percent}%`;
}

function CategoryRow({ row, color, onPress }: { row: TCategorySpend; color: string; onPress: () => void }) {
  const share = shareLabel(row.share);
  const amount = formatAmount(row.amount);

  return (
    <View>
      <AppListRow
        icon={row.icon}
        title={row.category}
        meta={countLabel(row.count, "transaction", "transactions")}
        amount={amount}
        caption={share}
        accessory="chevron-right"
        onPress={onPress}
        accessibilityLabel={`${row.category}, ${amount}, ${share}`}
      />
      <View className="pointer-events-none absolute left-[64px] right-5 bottom-[2px] h-[3px] rounded-full bg-white/[0.06]">
        <View className="h-full rounded-full" style={{ width: `${row.share * 100}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const { loading } = useExpenses();
  const { width } = useWindowDimensions();
  const feed = useActivityFeed();
  const params = useLocalSearchParams<{ year?: string; month?: string; period?: string; type?: string }>();
  const [{ year, month, period, type }, setSelected] = useSetState<{ year: number; month: number; period: Period; type: MoneyFlow }>({
    year: Number(params.year ?? dayjs().year()),
    month: Number(params.month ?? dayjs().month()),
    period: parsePeriod(params.period),
    type: parseMoneyFlow(params.type),
  });

  // Slices come from the same rows Activity lists, so a category's rows there always add up to its slice here.
  const { expenseRows, incomeRows } = useMemo(() => {
    const entries = feed.all.filter(({ effDate }) => isInPeriod(effDate, year, month, period));
    return { expenseRows: categoryRows(entries, "expenses"), incomeRows: categoryRows(entries, "income") };
  }, [feed.all, year, month, period]);

  const rows = type === "income" ? incomeRows : expenseRows;
  const copy = COPY[type];
  const total = sumBy(rows, "amount");
  const typeTabs: TUnderlineTab<MoneyFlow>[] = [
    { label: "Income", detail: formatAmount(sumBy(incomeRows, "amount")), value: "income" },
    { label: "Expenses", detail: formatAmount(sumBy(expenseRows, "amount")), value: "expenses" },
  ];
  const rest = rows.slice(chartHues.length);
  const segments = [
    ...rows.slice(0, chartHues.length).map(({ category, amount, share }, index) => ({
      key: category,
      value: amount,
      color: chartHues[index],
      label: category,
      caption: shareLabel(share),
    })),
    ...(rest.length > 0
      ? [
          {
            key: OTHER_SEGMENT_KEY,
            value: sumBy(rest, "amount"),
            color: chartRest,
            label: "Others",
            caption: shareLabel(sumBy(rest, "share")),
          },
        ]
      : []),
  ];
  const donutRadius = Math.round(width * DONUT_RADIUS_RATIO);
  const periodLabel = dayjs(new Date(year, month, 1)).format(period === "year" ? "YYYY" : "MMMM YYYY");

  // Back to the Activity tab underneath, showing just this category's rows for the same period. Slices count every
  // row, so Activity's type filter goes back to All.
  function openCategory(category: string) {
    router.dismissTo({
      pathname: "/expenses",
      params: { category, type, segment: "all", period, year: String(year), month: String(month) },
    });
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
        <TouchableOpacity onPress={() => router.back()} className="w-11 h-11 items-center justify-center">
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="title" className="flex-1" numberOfLines={1}>
          Stats
        </AppText>
        <PeriodNavigator
          unit={period}
          year={year}
          month={month}
          onChange={(year, month) => setSelected({ year, month })}
        />
      </View>

      <AppTabs tabs={PERIODS} value={period} onChange={(period) => setSelected({ period })} className="mx-5 mt-1" />

      <AppUnderlineTabs tabs={typeTabs} value={type} onChange={(type) => setSelected({ type })} className="mt-1" />

      <FlatList
        data={rows}
        keyExtractor={({ category }) => category}
        renderItem={({ item, index }) => (
          <CategoryRow row={item} color={chartHues[index] ?? chartRest} onPress={() => openCategory(item.category)} />
        )}
        contentContainerClassName="pb-5"
        ListHeaderComponent={
          rows.length > 0 ? (
            <View className="items-center pb-2">
              <AppDonutChart
                segments={segments}
                width={width}
                radius={donutRadius}
                thickness={Math.round(donutRadius * DONUT_THICKNESS_RATIO)}
              >
                <AppText variant="overline">{copy.overline}</AppText>
                <AppText
                  variant="title"
                  className="w-full px-3 text-center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatAmount(total)}
                </AppText>
                <AppText variant="meta">{countLabel(sumBy(rows, "count"), "transaction", "transactions")}</AppText>
              </AppDonutChart>
            </View>
          ) : undefined
        }
        ListEmptyComponent={<EmptyState title={copy.emptyTitle} icon={copy.emptyIcon} message={`${copy.emptyMessage} ${periodLabel}`} />}
      />
    </SafeAreaView>
  );
}
