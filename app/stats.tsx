import React, { useMemo } from "react";
import { FlatList, TouchableOpacity, useWindowDimensions, View } from "react-native";
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
import { AppUnderlineTabs, type TUnderlineTab } from "@/components/ui/AppUnderlineTabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { chartHues, chartRest, colors } from "@/constants/theme";
import { categoryIcon } from "@/utils/categories";
import { countLabel } from "@/utils/countLabel";
import { formatAmount } from "@/utils/formatAmount";
import { categoryBreakdown, type TCategorySpend } from "@/utils/stats/categoryBreakdown";
import { useInterestCredits, usePaidLedger } from "@/utils/usePaidLedger";
import { useSetState } from "@/utils/useSetState";
import type { FeatherIconName } from "@/types";

type Period = "month" | "year";
type StatsType = "income" | "expenses";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

const COPY: Record<StatsType, { overline: string; emptyTitle: string; emptyIcon: FeatherIconName; emptyMessage: string }> = {
  income: { overline: "Received", emptyTitle: "No income", emptyIcon: "arrow-down-left", emptyMessage: "No income in" },
  expenses: { overline: "Spent", emptyTitle: "Nothing spent", emptyIcon: "pie-chart", emptyMessage: "No expenses in" },
};

const FEES_CATEGORY = "Fees";
const INTEREST_CATEGORY = "Interest";
const UNCATEGORIZED_INCOME = "Other";
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
  const { width } = useWindowDimensions();
  const ledger = usePaidLedger();
  const interestCredits = useInterestCredits();
  const params = useLocalSearchParams<{ year?: string; month?: string; type?: string }>();
  const [{ year, month, period, type }, setSelected] = useSetState<{ year: number; month: number; period: Period; type: StatsType }>({
    year: Number(params.year ?? dayjs().year()),
    month: Number(params.month ?? dayjs().month()),
    period: "month",
    type: params.type === "income" ? "income" : "expenses",
  });

  // Card charges count on the day they were charged, so bill payments stay out: they only settle what's already here.
  // Loans stay out too: lent money is still yours and counts in net worth.
  const expenseLines = useMemo(
    () => [
      ...ledger.map(({ expense, amount, effDate }) => ({ category: expense.category, amount, effDate })),
      ...transactions
        .filter(({ kind }) => kind === "fee")
        .map(({ amount, createdAt }) => ({ category: FEES_CATEGORY, amount: Math.abs(amount), effDate: new Date(createdAt) })),
    ],
    [ledger, transactions]
  );

  // Loan repayments stay out for the same reason: getting lent money back isn't earning it.
  const incomeLines = useMemo(
    () => [
      ...transactions
        .filter(({ kind }) => kind === "income")
        .map(({ category, amount, createdAt }) => ({ category: category ?? UNCATEGORIZED_INCOME, amount, effDate: new Date(createdAt) })),
      ...interestCredits.map(({ amount, effDate }) => ({ category: INTEREST_CATEGORY, amount, effDate })),
    ],
    [transactions, interestCredits]
  );

  const { expenseRows, incomeRows } = useMemo(() => {
    const isInPeriod = ({ effDate }: { effDate: Date }) =>
      effDate.getFullYear() === year && (period === "year" || effDate.getMonth() === month);
    return {
      expenseRows: categoryBreakdown(expenseLines.filter(isInPeriod)),
      incomeRows: categoryBreakdown(incomeLines.filter(isInPeriod)),
    };
  }, [expenseLines, incomeLines, year, month, period]);

  const rows = type === "income" ? incomeRows : expenseRows;
  const copy = COPY[type];
  const total = sumBy(rows, "amount");
  const typeTabs: TUnderlineTab<StatsType>[] = [
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
        renderItem={({ item, index }) => <CategoryRow row={item} color={chartHues[index] ?? chartRest} />}
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
          ) : null
        }
        ListEmptyComponent={<EmptyState title={copy.emptyTitle} icon={copy.emptyIcon} message={`${copy.emptyMessage} ${periodLabel}`} />}
      />
    </SafeAreaView>
  );
}
