import React, { useMemo } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { sumBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { EmptyState } from "@/components/EmptyState";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { AppDonutChart } from "@/components/ui/AppDonutChart";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppText } from "@/components/ui/AppText";
import { LoadingState } from "@/components/ui/LoadingState";
import { chartHues, chartRest, colors } from "@/constants/theme";
import { categoryIcon } from "@/utils/categories";
import { countLabel } from "@/utils/countLabel";
import { formatAmount } from "@/utils/dateHelpers";
import { categoryBreakdown, type TCategorySpend } from "@/utils/stats/categoryBreakdown";
import { usePaidLedger } from "@/utils/usePaidLedger";
import { useSetState } from "@/utils/useSetState";

type Period = "month" | "year";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const FEES_CATEGORY = "Fees";
const OTHER_SEGMENT_KEY = "other-categories";
const DONUT_SIZE = 216;
const DONUT_THICKNESS = 30;

function shareLabel(share: number) {
  const percent = Math.round(share * 100);
  if (percent < 1) {
    return "<1%";
  }
  return percent === 100 && share < 1 ? ">99%" : `${percent}%`;
}

function CategoryRow({ row, color }: { row: TCategorySpend; color: string }) {
  const share = shareLabel(row.share);
  const amount = formatAmount(row.amount);

  return (
    <View>
      <AppListRow
        icon={categoryIcon(row.category)}
        title={row.category}
        meta={countLabel(row.count, "transaction", "transactions")}
        amount={amount}
        caption={share}
        accessibilityLabel={`${row.category}, ${amount}, ${share}`}
      />
      <View className="absolute left-[64px] right-5 bottom-[2px] h-[3px] rounded-full bg-white/[0.06]">
        <View className="h-full rounded-full" style={{ width: `${row.share * 100}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const { loading } = useExpenses();
  const { transactions } = useAccounts();
  const ledger = usePaidLedger();
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const [{ year, month, period }, setSelected] = useSetState<{ year: number; month: number; period: Period }>({
    year: Number(params.year ?? dayjs().year()),
    month: Number(params.month ?? dayjs().month()),
    period: "month",
  });

  // Card charges count on the day they were charged, so bill payments stay out: they only settle what's already here.
  // Loans stay out too: lent money is still yours and counts in net worth.
  const lines = useMemo(
    () => [
      ...ledger.map(({ expense, amount, effDate }) => ({ category: expense.category, amount, effDate })),
      ...transactions
        .filter(({ kind }) => kind === "fee")
        .map(({ amount, createdAt }) => ({ category: FEES_CATEGORY, amount: Math.abs(amount), effDate: new Date(createdAt) })),
    ],
    [ledger, transactions]
  );

  const rows = useMemo(
    () =>
      categoryBreakdown(
        lines.filter(({ effDate }) => effDate.getFullYear() === year && (period === "year" || effDate.getMonth() === month))
      ),
    [lines, year, month, period]
  );

  const total = sumBy(rows, "amount");
  const rest = rows.slice(chartHues.length);
  const segments = [
    ...rows.slice(0, chartHues.length).map(({ category, amount }, index) => ({ key: category, value: amount, color: chartHues[index] })),
    ...(rest.length > 0 ? [{ key: OTHER_SEGMENT_KEY, value: sumBy(rest, "amount"), color: chartRest }] : []),
  ];
  const periodLabel = dayjs(new Date(year, month, 1)).format(period === "year" ? "YYYY" : "MMMM YYYY");

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

      <FlatList
        data={rows}
        keyExtractor={({ category }) => category}
        renderItem={({ item, index }) => <CategoryRow row={item} color={chartHues[index] ?? chartRest} />}
        contentContainerClassName="pb-5"
        ListHeaderComponent={
          rows.length > 0 ? (
            <View className="items-center py-6">
              <AppDonutChart segments={segments} size={DONUT_SIZE} thickness={DONUT_THICKNESS}>
                <AppText variant="overline">Spent</AppText>
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
          ) : null
        }
        ListEmptyComponent={<EmptyState title="Nothing spent" icon="pie-chart" message={`No expenses in ${periodLabel}`} />}
      />
    </SafeAreaView>
  );
}
