import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { colors } from "@/constants/theme";
import { AppButton } from "@/components/ui/AppButton";

interface Props {
  unit?: "month" | "year";
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function PeriodNavigator({ unit = "month", year, month, onChange }: Props) {
  const current = dayjs(new Date(year, month, 1));
  const isCurrentPeriod = current.isSame(dayjs(), unit);

  function step(delta: number) {
    const next = current.add(delta, unit);
    onChange(next.year(), next.month());
  }

  function resetToToday() {
    if (!isCurrentPeriod) {
      const today = dayjs();
      onChange(today.year(), today.month());
    }
  }

  const label = current.format(unit === "year" ? "YYYY" : "MMM YYYY");

  return (
    <View className="flex-row items-center justify-between">
      {!isCurrentPeriod && (
        <AppButton
          label="Today"
          variant="tonal"
          size="sm"
          onPress={resetToToday}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          className="mr-1"
          accessibilityLabel={`Back to current ${unit}`}
        />
      )}

      <TouchableOpacity
        onPress={() => step(-1)}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={`Previous ${unit}`}
      >
        <Feather name="chevron-left" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resetToToday}
        className="min-h-[44px] justify-center px-2"
        disabled={isCurrentPeriod}
        accessibilityRole="button"
        accessibilityLabel={`Jump to current ${unit}`}
        accessibilityState={{ disabled: isCurrentPeriod }}
        accessibilityValue={{ text: label }}
      >
        <Text
          className={`text-[15px] tracking-wide font-['Quicksand_600SemiBold'] ${
            isCurrentPeriod ? "text-secondary" : "text-textSecondary"
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => step(1)}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={`Next ${unit}`}
      >
        <Feather name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
