import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { colors } from "@/constants/theme";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthNavigator({ year, month, onChange }: Props) {
  const today = dayjs().startOf("day").toDate();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) {
      onChange(year - 1, 11);
    } else {
      onChange(year, month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      onChange(year + 1, 0);
    } else {
      onChange(year, month + 1);
    }
  }

  function resetToToday() {
    if (!isCurrentMonth) {
      onChange(today.getFullYear(), today.getMonth());
    }
  }

  const label = dayjs(new Date(year, month, 1)).format("MMM YYYY");

  return (
    <View className="flex-row items-center justify-between">
      {!isCurrentMonth && (
        <TouchableOpacity
          onPress={resetToToday}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          className="h-7 px-3 mr-1 rounded-full items-center justify-center bg-primary/15 border border-primary"
          accessibilityRole="button"
          accessibilityLabel="Back to current month"
        >
          <Text className="text-xs text-secondary font-['Quicksand_700Bold']">
            Today
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={prevMonth}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <Feather name="chevron-left" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resetToToday}
        className="min-h-[44px] justify-center px-2"
        disabled={isCurrentMonth}
        accessibilityRole="button"
        accessibilityLabel="Jump to current month"
        accessibilityState={{ disabled: isCurrentMonth }}
        accessibilityValue={{ text: label }}
      >
        <Text
          className={`text-[15px] tracking-wide font-['Quicksand_600SemiBold'] ${
            isCurrentMonth ? "text-secondary" : "text-textSecondary"
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={nextMonth}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Next month"
      >
        <Feather name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
