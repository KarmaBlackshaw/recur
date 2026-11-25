import React, { useMemo, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import { EmptyState } from "@/components/EmptyState";
import { AppLineChart } from "@/components/ui/AppLineChart";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { bucketFlows, type TFlowBucket } from "@/utils/stats/bucketFlows";
import { bucketLabel } from "@/utils/stats/bucketLabel";
import { bucketTicks } from "@/utils/stats/bucketTicks";
import { netReadout, signedNet } from "@/utils/stats/netReadout";
import { runningNet } from "@/utils/stats/runningNet";
import type { Period } from "@/types";

const LINE_PLOT_HEIGHT = 140;

interface TTrendRow extends TFlowBucket {
  index: number;
}

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

export function StatsTrendView({ entries, year, month, period, periodLabel }: {
  entries: ActivityEntry[];
  year: number;
  month: number;
  period: Period;
  periodLabel: string;
}) {
  const listRef = useRef<FlatList<TTrendRow>>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const scope = `${period}:${year}:${month}`;
  const [selection, setSelection] = useState<{ scope: string; index: number }>();
  if (selection != null && selection.scope !== scope) {
    setSelection(undefined);
  }
  const selectedIndex = selection?.scope === scope ? selection.index : undefined;
  const buckets = useMemo(() => bucketFlows({ entries, year, month, period }), [entries, year, month, period]);
  const points = useMemo(() => runningNet(buckets, new Date()), [buckets]);
  const rows = buckets
    .slice(0, points.length)
    .map((bucket, index) => ({ ...bucket, index }))
    .filter(({ income, expenses }) => income > 0 || expenses > 0)
    .reverse();
  const last = points[points.length - 1];
  const selected = (selectedIndex == null ? undefined : points[selectedIndex]) ?? last;

  function onSelect(index: number | undefined) {
    setSelection(index == null ? undefined : { scope, index });
  }

  function selectRow(index: number) {
    onSelect(index === selectedIndex ? undefined : index);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={({ key }) => key}
      renderItem={({ item }) => {
        const title = bucketLabel(item, period);
        const amount = formatAmount(item.expenses);
        const received = item.income > 0 ? formatAmount(item.income) : undefined;
        return (
          <AppListRow
            icon="calendar"
            title={title}
            amount={amount}
            amountTone={item.expenses > 0 ? "neutral" : "muted"}
            caption={received ? `+${received}` : undefined}
            captionTone="positive"
            onPress={() => selectRow(item.index)}
            accessibilityLabel={`${title}, spent ${amount}${received ? `, received ${received}` : ""}`}
          />
        );
      }}
      contentContainerClassName="pb-5"
      ListHeaderComponent={
        rows.length > 0 && selected && last ? (
          <View className="pt-3 pb-2">
            <AppText variant="overline" className="px-5" testID="stats-trend-readout">
              {netReadout(selected, period)}
            </AppText>
            <View className="flex-row gap-4 px-5 mt-2">
              <LegendFigure label="Income" color={colors.paid} amount={selected.income} testID="stats-trend-income" />
              <LegendFigure
                label="Expenses"
                color={colors.secondary}
                amount={selected.expenses}
                testID="stats-trend-expenses"
              />
            </View>
            <View className="mx-5 mt-3" onLayout={({ nativeEvent: { layout } }) => setChartWidth(layout.width)}>
              {chartWidth > 0 ? (
                <AppLineChart
                  values={points.map(({ net }) => net)}
                  slots={buckets.length}
                  width={chartWidth}
                  height={LINE_PLOT_HEIGHT}
                  lineColor={colors.text}
                  aboveColor={colors.paid}
                  belowColor={colors.secondary}
                  ticks={bucketTicks(buckets, period)}
                  endLabel={signedNet(last.net)}
                  selectedIndex={selectedIndex}
                  onSelect={onSelect}
                  accessibilityLabel={`Net so far, ${netReadout(selected, period)}`}
                  testID="stats-trend-chart"
                />
              ) : null}
            </View>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState title="No activity" icon="trending-up" message={`Nothing spent or received in ${periodLabel} so far`} />
      }
    />
  );
}
