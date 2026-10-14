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
    <View
      className="flex-row bg-surface rounded-full p-1 border border-border"
      accessibilityRole="radiogroup"
    >
      {DAY_WINDOWS.map((days) => {
        const active = days === value;
        return (
          <TouchableOpacity
            key={days}
            onPress={() => onChange(days)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={`Show ${windowLabel(days)} window`}
            className={`flex-1 min-h-[44px] justify-center rounded-full items-center ${active ? "bg-primary" : ""}`}
          >
            <Text
              className={active ? "text-white text-[13px]" : "text-textSecondary text-[13px]"}
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
