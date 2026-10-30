import React from "react";
import { View } from "react-native";
import { maxBy, sumBy } from "@/utils/collections";

const GAP = 2;

interface TDonutSegment {
  key: string;
  value: number;
  color: string;
}

interface AppDonutChartProps {
  segments: TDonutSegment[];
  size: number;
  thickness: number;
  children?: React.ReactNode;
}

// There's no SVG in this app, so a wedge is a half-disc rotated inside a half-width clip. That clip shows 180° at
// most, and only the largest segment can pass 180°, so it's painted as the full disc under the others. That disc
// shows through a translucent segment, so colors must be opaque.
export function AppDonutChart({ segments, size, thickness, children }: AppDonutChartProps) {
  const total = sumBy(segments, "value");
  let angle = 0;
  const wedges = segments.map((segment) => {
    const start = angle;
    const sweep = (segment.value / total) * 360;
    angle += sweep;
    return { ...segment, start, sweep };
  });
  const largest = maxBy(wedges, "sweep");

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <View className="absolute inset-0 rounded-full" style={{ backgroundColor: largest?.color }} />
      {wedges
        .filter((wedge) => wedge !== largest)
        .map(({ key, color, start, sweep }) => (
          <View key={key} className="absolute inset-0" style={{ transform: [{ rotate: `${start}deg` }] }}>
            <View className="absolute top-0 bottom-0 right-0 w-1/2 overflow-hidden">
              <View
                className="absolute top-0"
                style={{ left: -size / 2, width: size, height: size, transform: [{ rotate: `${sweep}deg` }] }}
              >
                <View
                  className="h-full w-1/2"
                  style={{ backgroundColor: color, borderTopLeftRadius: size / 2, borderBottomLeftRadius: size / 2 }}
                />
              </View>
            </View>
          </View>
        ))}
      {wedges.length > 1
        ? wedges.map(({ key, start }) => (
            <View key={key} className="absolute inset-0 items-center" style={{ transform: [{ rotate: `${start}deg` }] }}>
              <View className="bg-background" style={{ width: GAP, height: size / 2 }} />
            </View>
          ))
        : null}
      <View
        className="items-center justify-center rounded-full bg-background"
        style={{ width: size - thickness * 2, height: size - thickness * 2 }}
      >
        {children}
      </View>
    </View>
  );
}
