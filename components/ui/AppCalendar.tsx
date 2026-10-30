import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { range } from "@/utils/collections";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

// A month grid in the app's own type and colors. Pure JS, so it behaves the same on iOS and Android.
export function AppCalendar({ value, onChange, minimumDate, maximumDate }: Props) {
  const [visible, setVisible] = useState(() => dayjs(value).startOf("month"));
  const today = dayjs().startOf("day");
  const min = minimumDate ? dayjs(minimumDate).startOf("day") : null;
  const max = maximumDate ? dayjs(maximumDate).startOf("day") : null;
  const canGoBack = min == null || visible.isAfter(min, "month");
  const canGoForward = max == null || visible.isBefore(max, "month");
  const leading = visible.day();
  const days = range(1, visible.daysInMonth() + 1);
  const cells: (number | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  function isDisabled(day: dayjs.Dayjs) {
    return (min != null && day.isBefore(min)) || (max != null && day.isAfter(max));
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <TouchableOpacity
          onPress={() => setVisible((v) => v.subtract(1, "month"))}
          disabled={!canGoBack}
          className={`w-11 h-11 items-center justify-center ${canGoBack ? "" : "opacity-30"}`}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
        >
          <Feather name="chevron-left" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <AppText variant="title" className="text-[18px]" accessibilityRole="header">
          {visible.format("MMMM YYYY")}
        </AppText>
        <TouchableOpacity
          onPress={() => setVisible((v) => v.add(1, "month"))}
          disabled={!canGoForward}
          className={`w-11 h-11 items-center justify-center ${canGoForward ? "" : "opacity-30"}`}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
        >
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-1" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAYS.map((label, index) => (
          <View key={index} className="flex-1 items-center">
            <AppText variant="overline" className="text-textMuted">{label}</AppText>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (day == null) {
            return <View key={`blank-${index}`} className="w-[14.28%] h-11" />;
          }
          const date = visible.date(day);
          const isSelected = date.isSame(value, "day");
          const isToday = date.isSame(today, "day");
          const disabled = isDisabled(date);
          const circle = isSelected ? "bg-primary" : isToday ? "border border-secondary" : "";
          return (
            <View key={day} className="w-[14.28%] h-11 items-center justify-center">
              <TouchableOpacity
                onPress={() => onChange(date.toDate())}
                disabled={disabled}
                className={`w-10 h-10 rounded-full items-center justify-center ${circle} ${disabled ? "opacity-30" : ""}`}
                accessibilityRole="button"
                accessibilityLabel={date.format("dddd, MMMM D, YYYY")}
                accessibilityState={{ selected: isSelected, disabled }}
              >
                <AppText
                  variant={isSelected ? "body-bold" : "body-medium"}
                  className={`text-[15px] ${isSelected ? "text-white" : "text-textSecondary"}`}
                >
                  {day}
                </AppText>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}
