import React, { useRef } from "react";
import { View, type AccessibilityActionEvent, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { colors } from "@/constants/theme";
import { layoutLine, lineSlotAt, type TLinePoint } from "@/utils/charts/layoutLine";

const INSET = 8;
const TOP_GUTTER = 12;
const TICK_ROW = 16;
const STROKE_WIDTH = 2;
const AREA_OPACITY = 0.18;
const DOT_RADIUS = 4.5;
const END_DOT_RADIUS = 3;
const TICK_FONT_SIZE = 10;
const TICK_FONT = "Quicksand_500Medium";
const LABEL_FONT_SIZE = 12;
const LABEL_FONT = "Quicksand_700Bold";
const LABEL_GAP = 6;
const DRAG_SLOP = 6;
const ACCESSIBILITY_ACTIONS = [{ name: "increment" }, { name: "decrement" }];

interface AppLineChartProps {
  values: number[];
  slots: number;
  width: number;
  height: number;
  lineColor: string;
  aboveColor: string;
  belowColor: string;
  ticks?: (string | undefined)[];
  endLabel?: string;
  selectedIndex?: number;
  onSelect: (index: number | undefined) => void;
  accessibilityLabel?: string;
  testID?: string;
}

interface TEndLabel {
  x: number;
  y: number;
  anchor: "start" | "end";
}

function placeEndLabel(text: string, points: TLinePoint[], width: number, height: number): TEndLabel {
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const textWidth = text.length * LABEL_FONT_SIZE * 0.6;
  if (last.x + LABEL_GAP + textWidth <= width) {
    return { x: last.x + LABEL_GAP, y: last.y + LABEL_FONT_SIZE / 3, anchor: "start" };
  }
  const aboveY = last.y - LABEL_GAP;
  const belowY = last.y + LABEL_GAP + LABEL_FONT_SIZE * 0.8;
  const fitsAbove = aboveY - LABEL_FONT_SIZE >= -TOP_GUTTER;
  const fitsBelow = belowY <= height;
  const lineComesFromAbove = previous != null && previous.y < last.y;
  const isBelow = fitsBelow && (lineComesFromAbove || !fitsAbove);
  return { x: last.x, y: isBelow ? belowY : aboveY, anchor: "end" };
}

export function AppLineChart({
  values,
  slots,
  width,
  height,
  lineColor,
  aboveColor,
  belowColor,
  ticks,
  endLabel,
  selectedIndex,
  onSelect,
  accessibilityLabel,
  testID,
}: AppLineChartProps) {
  const { slotXs, points, linePath, abovePath, belowPath, baselineY, gridlines } = layoutLine({
    values,
    slots,
    width,
    height,
    inset: INSET,
  });
  const touch = useRef({ startX: 0, startPageX: 0, isDragging: false });
  const totalHeight = TOP_GUTTER + height + TICK_ROW;
  const lastIndex = values.length - 1;
  const last = points[lastIndex];
  const selected = selectedIndex == null ? undefined : points[selectedIndex];
  const toneOf = (value: number) => (value > 0 ? aboveColor : value < 0 ? belowColor : lineColor);
  const label = endLabel && last ? placeEndLabel(endLabel, points, width, height) : undefined;

  function indexAt(x: number): number {
    return Math.min(lineSlotAt(x, slots, width, INSET), lastIndex);
  }

  function onGrant({ nativeEvent }: GestureResponderEvent) {
    touch.current = { startX: nativeEvent.locationX, startPageX: nativeEvent.pageX, isDragging: false };
  }

  function onMove({ nativeEvent }: GestureResponderEvent) {
    const dx = nativeEvent.pageX - touch.current.startPageX;
    if (!touch.current.isDragging && Math.abs(dx) < DRAG_SLOP) {
      return;
    }
    touch.current.isDragging = true;
    onSelect(indexAt(touch.current.startX + dx));
  }

  function onRelease() {
    if (touch.current.isDragging) {
      return;
    }
    const slot = lineSlotAt(touch.current.startX, slots, width, INSET);
    if (slot > lastIndex) {
      return;
    }
    onSelect(slot === selectedIndex ? undefined : slot);
  }

  function onAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    const current = selectedIndex ?? lastIndex;
    const step = nativeEvent.actionName === "increment" ? 1 : -1;
    onSelect(Math.min(Math.max(current + step, 0), lastIndex));
  }

  return (
    <View style={{ width, height: totalHeight }}>
      <Svg width={width} height={totalHeight}>
        <G transform={`translate(0 ${TOP_GUTTER})`}>
          {gridlines
            .filter(({ y }) => Math.abs(y - baselineY) > 0.5)
            .map(({ value, y }) => (
              <Line key={value} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
            ))}
          {abovePath ? <Path d={abovePath} fill={aboveColor} fillOpacity={AREA_OPACITY} /> : null}
          {belowPath ? <Path d={belowPath} fill={belowColor} fillOpacity={AREA_OPACITY} /> : null}
          <Line x1={0} x2={width} y1={baselineY} y2={baselineY} stroke={colors.textMuted} strokeWidth={1} />
          {selected ? (
            <Line x1={selected.x} x2={selected.x} y1={0} y2={height} stroke={colors.textMuted} strokeWidth={1} />
          ) : null}
          {linePath ? (
            <Path d={linePath} stroke={lineColor} strokeWidth={STROKE_WIDTH} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {last ? <Circle cx={last.x} cy={last.y} r={END_DOT_RADIUS} fill={lineColor} /> : null}
          {selected && selectedIndex != null ? (
            <Circle
              cx={selected.x}
              cy={selected.y}
              r={DOT_RADIUS}
              fill={toneOf(values[selectedIndex])}
              stroke={colors.background}
              strokeWidth={2}
            />
          ) : null}
          {label && endLabel ? (
            <SvgText
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fontSize={LABEL_FONT_SIZE}
              fontFamily={LABEL_FONT}
              fill={toneOf(values[lastIndex])}
            >
              {endLabel}
            </SvgText>
          ) : null}
          {ticks?.map((tick, index) =>
            tick ? (
              <SvgText
                key={index}
                x={slotXs[index]}
                y={height + 12}
                textAnchor="middle"
                fontSize={TICK_FONT_SIZE}
                fontFamily={TICK_FONT}
                fill={colors.textSecondary}
              >
                {tick}
              </SvgText>
            ) : null
          )}
        </G>
      </Svg>
      <View
        className="absolute left-0"
        style={{ top: TOP_GUTTER, width, height }}
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={onAccessibilityAction}
        onStartShouldSetResponder={() => values.length > 0}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminationRequest={() => !touch.current.isDragging}
      />
    </View>
  );
}
