import React from "react";
import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { colors } from "@/constants/theme";
import { layoutDonut } from "@/utils/charts/layoutDonut";

const AVERAGE_CHAR_WIDTH = 6.2;
const FONT_SIZE = 11;
const LINE_OFFSET = 13;

interface TDonutSegment {
  key: string;
  value: number;
  color: string;
  label: string;
  caption: string;
}

interface AppDonutChartProps {
  segments: TDonutSegment[];
  width: number;
  radius: number;
  thickness: number;
  children?: React.ReactNode;
}

export function AppDonutChart({ segments, width, radius, thickness, children }: AppDonutChartProps) {
  const { height, centerX, centerY, labelWidth, slices } = layoutDonut({
    values: segments.map(({ value }) => value),
    width,
    radius,
    thickness,
  });
  const maxChars = Math.floor(labelWidth / AVERAGE_CHAR_WIDTH);
  const fit = (label: string) => (label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label);
  const holeSize = (radius - thickness) * 2;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {segments.map(({ key, color }, index) => (
          <Path key={key} d={slices[index].leaderPath} stroke={color} strokeWidth={1} fill="none" />
        ))}
        {segments.map(({ key, color }, index) => (
          <Path key={key} d={slices[index].arcPath} stroke={color} strokeWidth={thickness} fill="none" />
        ))}
        {segments.map(({ key, label, caption }, index) => {
          const { side, labelX, labelY } = slices[index];
          const textAnchor = side === "right" ? "start" : "end";
          return (
            <React.Fragment key={key}>
              <SvgText x={labelX} y={labelY - 2} textAnchor={textAnchor} fill={colors.text} fontSize={FONT_SIZE} fontFamily="Quicksand_700Bold">
                {fit(label)}
              </SvgText>
              <SvgText x={labelX} y={labelY - 2 + LINE_OFFSET} textAnchor={textAnchor} fill={colors.textSecondary} fontSize={FONT_SIZE} fontFamily="Quicksand_500Medium">
                {caption}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View
        className="absolute items-center justify-center"
        style={{ left: centerX - holeSize / 2, top: centerY - holeSize / 2, width: holeSize, height: holeSize }}
      >
        {children}
      </View>
    </View>
  );
}
