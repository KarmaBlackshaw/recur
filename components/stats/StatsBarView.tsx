import React, { useMemo, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import { EmptyState } from "@/components/EmptyState";
import { AppBarChart } from "@/components/ui/AppBarChart";
import { AppChips } from "@/components/ui/AppChips";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { BAR_BUCKETS, resolveBarBucket } from "@/constants/periods";
import { sumBy } from "@/utils/collections";
import { formatAmount } from "@/utils/formatAmount";
import { bucketFlows, type TFlowBucket } from "@/utils/stats/bucketFlows";
import { bucketLabel } from "@/utils/stats/bucketLabel";
import { bucketTicks } from "@/utils/stats/bucketTicks";
import type { BarBucket, Period } from "@/types";

const BAR_PLOT_HEIGHT = 140;

function LegendFigure({ label, color, amount, testID }: { label: string; color: string; amount: number; testID: string }) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-1.5">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <AppText variant="meta">{label}</AppText>
      </View>
      <AppText variant="amount" testID={testID} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatAmount(amount)}
      </AppText>
    </View>
  );
}

export function StatsBarView({ entries, year, month, period, periodLabel }: {
  entries: ActivityEntry[];
  year: number;
  month: number;
  period: Period;
  periodLabel: string;
}) {
  const listRef = useRef<FlatList<TFlowBucket>>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [bucket, setBucket] = useState<BarBucket>("day");
  const activeBucket = resolveBarBucket(bucket, period);
  const scope = `${period}:${year}:${month}:${activeBucket}`;
  const [selection, setSelection] = useState<{ scope: string; key: string }>();
  if (selection != null && selection.scope !== scope) {
    setSelection(undefined);
  }
  const selectedKey = selection?.scope === scope ? selection.key : undefined;
  const buckets = useMemo(
    () => bucketFlows({ entries, year, month, period, bucket: activeBucket }),
    [entries, year, month, period, activeBucket]
  );
  const rows = buckets.filter(({ income, expenses }) => income > 0 || expenses > 0).reverse();
  const selected = buckets.find(({ key }) => key === selectedKey);
  const ticks = bucketTicks(buckets, activeBucket, period);
  const groups = buckets.map(({ key, income, expenses }, index) => ({ key, values: [income, expenses], tick: ticks[index] }));

  function onSelect(key: string) {
    setSelection(selectedKey === key ? undefined : { scope, key });
  }

  function selectRow(key: string) {
    onSelect(key);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={({ key }) => key}
      renderItem={({ item }) => {
        const title = bucketLabel(item, activeBucket);
        const amount = formatAmount(item.expenses);
        return (
          <AppListRow
            icon="calendar"
            title={title}
            amount={amount}
            amountTone={item.expenses > 0 ? "neutral" : "muted"}
            caption={item.income > 0 ? `+${formatAmount(item.income)}` : undefined}
            captionTone="positive"
            onPress={() => selectRow(item.key)}
            accessibilityLabel={`${title}, spent ${amount}`}
          />
        );
      }}
      contentContainerClassName="pb-5"
      ListHeaderComponent={
        rows.length > 0 ? (
          <View className="pt-3 pb-2">
            <AppText variant="overline" className="px-5" testID="stats-bar-readout-label">
              {selected ? bucketLabel(selected, activeBucket) : periodLabel}
            </AppText>
            <View className="flex-row gap-4 px-5 mt-2">
              <LegendFigure
                label="Income"
                color={colors.paid}
                amount={selected ? selected.income : sumBy(buckets, "income")}
                testID="stats-bar-income"
              />
              <LegendFigure
                label="Expenses"
                color={colors.secondary}
                amount={selected ? selected.expenses : sumBy(buckets, "expenses")}
                testID="stats-bar-expenses"
              />
            </View>
            <AppChips
              chips={BAR_BUCKETS[period]}
              value={activeBucket}
              onChange={setBucket}
              accessibilityLabel="Group by"
              className="mt-3"
            />
            <View className="mx-5 mt-3" onLayout={({ nativeEvent: { layout } }) => setChartWidth(layout.width)}>
              {chartWidth > 0 ? (
                <AppBarChart
                  groups={groups}
                  colors={[colors.paid, colors.secondary]}
                  width={chartWidth}
                  height={BAR_PLOT_HEIGHT}
                  formatValue={formatAmount}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                />
              ) : null}
            </View>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState title="No activity" icon="bar-chart-2" message={`Nothing spent or received in ${periodLabel}`} />
      }
    />
  );
}
