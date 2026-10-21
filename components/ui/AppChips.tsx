import React from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { AppText } from "@/components/ui/AppText";

interface Chip<T extends string> {
  label: string;
  value: T;
}

interface AppChipsProps<T extends string> {
  chips: Chip<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  className?: string;
}

export function AppChips<T extends string>({ chips, value, onChange, accessibilityLabel, className = "" }: AppChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={`grow-0 shrink-0 ${className}`}
      contentContainerClassName="gap-2 px-5"
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {chips.map((chip) => {
        const isSelected = value === chip.value;
        return (
          <TouchableOpacity
            key={chip.value}
            className={`items-center justify-center min-h-[44px] px-4 rounded-full border ${
              isSelected ? "bg-primary/15 border-primary" : "bg-surface border-border"
            }`}
            onPress={() => onChange(chip.value)}
            accessibilityRole="radio"
            accessibilityLabel={chip.label}
            accessibilityState={{ selected: isSelected, checked: isSelected }}
          >
            <AppText
              variant={isSelected ? "body-bold" : "body-medium"}
              className={`text-sm ${isSelected ? "text-secondary" : "text-textSecondary"}`}
            >
              {chip.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
