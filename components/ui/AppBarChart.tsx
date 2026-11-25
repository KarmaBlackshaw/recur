import React from "react";
import { Pressable, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "@/constants/theme";
import { layoutBars } from "@/utils/charts/layoutBars";

const TOP_GUTTER = 14;
const TICK_ROW = 16;
const FONT_SIZE = 10;
const FONT_FAMILY = "Quicksand_500Medium";

interface TBarGroup {
  key: string;
  values: number[];
  tick?: string;
}

interface AppBarChartProps {
  groups: TBarGroup[];
  colors: string[];
  width: number;
  height: number;
  formatValue: (value: number) => string;
  selectedKey?: string;
  onSelect: (key: string) => void;
}

export function AppBarChart({ groups, colors: seriesColors, width, height, formatValue, selectedKey, onSelect }: AppBarChartProps) {
  const { slots, max } = layoutBars({ groups: groups.map(({ values }) => values), width, height });
  const totalHeight = TOP_GUTTER + height + TICK_ROW;

  return (
    <View style={{ width, height: totalHeight }}>
      <Svg width={width} height={totalHeight}>
        {max > 0 ? (
          <>
            <Line x1={0} y1={TOP_GUTTER} x2={width} y2={TOP_GUTTER} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="4 4" />
            <SvgText x={width} y={TOP_GUTTER - 4} textAnchor="end" fontSize={FONT_SIZE} fontFamily={FONT_FAMILY} fill={colors.textMuted}>
              {formatValue(max)}
            </SvgText>
          </>
        ) : null}
        {groups.map(({ key, tick }, index) => {
          const slot = slots[index];
          return (
            <React.Fragment key={key}>
              {key === selectedKey ? (
                <Rect x={slot.x} y={TOP_GUTTER} width={slot.width} height={height} rx={3} fill={colors.text} fillOpacity={0.06} />
              ) : null}
              {slot.bars.map((bar, seriesIndex) => (
                <Rect
                  key={seriesIndex}
                  x={bar.x}
                  y={TOP_GUTTER + bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx={Math.min(2, bar.width / 2)}
                  fill={seriesColors[seriesIndex]}
                />
              ))}
              {tick ? (
                <SvgText
                  x={slot.x + slot.width / 2}
                  y={TOP_GUTTER + height + 12}
                  textAnchor="middle"
                  fontSize={FONT_SIZE}
                  fontFamily={FONT_FAMILY}
                  fill={colors.textSecondary}
                >
                  {tick}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      <View className="absolute left-0 right-0 flex-row" style={{ top: TOP_GUTTER, height }}>
        {groups.map(({ key }) => (
          <Pressable key={key} className="flex-1" testID={`app-bar-chart-slot-${key}`} onPress={() => onSelect(key)} />
        ))}
      </View>
    </View>
  );
}
