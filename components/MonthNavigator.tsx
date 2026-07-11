import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { colors } from "../constants/theme";

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

  const label = dayjs(new Date(year, month, 1)).format("MMMM YYYY");

  return (
    <View className="flex-row items-center px-4 py-2 gap-4">
      <TouchableOpacity
        onPress={prevMonth}
        className="w-8 h-8 items-center justify-center"
        accessibilityLabel="Previous month"
      >
        <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity onPress={resetToToday} disabled={isCurrentMonth}>
        <Text
          className="text-[15px] tracking-wide font-['Quicksand_600SemiBold']"
          style={{ color: isCurrentMonth ? colors.secondary : "rgba(255,255,255,0.55)" }}
        >
          {label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={nextMonth}
        className="w-8 h-8 items-center justify-center"
        accessibilityLabel="Next month"
      >
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );
}
