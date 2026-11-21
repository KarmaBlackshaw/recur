import React from "react";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { layoutLine } from "@/utils/charts/layoutLine";

const INSET = 6;
const STROKE_WIDTH = 2;
const AREA_OPACITY = 0.12;
const DOT_RADIUS = 4;

interface TLineReference {
  value: number;
  color: string;
}

interface AppLineChartProps {
  values: number[];
  width: number;
  height: number;
  color: string;
  reference?: TLineReference;   // Drawn as a dashed line across the chart.
  markIndex?: number;   // The value to mark with a dot.
  markColor?: string;
}

export function AppLineChart({ values, width, height, color, reference, markIndex, markColor = color }: AppLineChartProps) {
  const { points, linePath, areaPath, referenceY } = layoutLine({
    values,
    width,
    height,
    inset: INSET,
    reference: reference?.value,
  });
  const mark = markIndex == null ? undefined : points[markIndex];

  return (
    <Svg width={width} height={height}>
      <Path d={areaPath} fill={color} fillOpacity={AREA_OPACITY} />
      {reference && referenceY != null && (
        <Line x1={0} x2={width} y1={referenceY} y2={referenceY} stroke={reference.color} strokeWidth={1} strokeDasharray="4 4" />
      )}
      <Path d={linePath} stroke={color} strokeWidth={STROKE_WIDTH} fill="none" strokeLinejoin="round" />
      {mark && <Circle cx={mark.x} cy={mark.y} r={DOT_RADIUS} fill={markColor} />}
    </Svg>
  );
}
