import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export const DAY_WINDOWS = [1, 7, 15] as const;
export type DayWindow = (typeof DAY_WINDOWS)[number];

export const windowLabel = (days: number): string => `${days} Day${days === 1 ? "" : "s"}`;

interface Props {
  value: DayWindow;
  onChange: (value: DayWindow) => void;
}

export function DayWindowSelector({ value, onChange }: Props) {
  return (
    <View className="flex-row mx-5 mt-3 mb-1 bg-surface rounded-full p-1 border border-white/[0.07]">
      {DAY_WINDOWS.map((days) => {
        const active = days === value;
        return (
          <TouchableOpacity
            key={days}
            onPress={() => onChange(days)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${windowLabel(days)} window`}
            className={`flex-1 py-2 rounded-full items-center ${active ? "bg-primary" : ""}`}
          >
            <Text
              className={active ? "text-white text-[13px]" : "text-white/50 text-[13px]"}
              style={{ fontFamily: "Quicksand_600SemiBold" }}
            >
              {windowLabel(days)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
