import React from "react";
import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";

interface Option<T extends string> {
  label: string;
  value: T;
}

interface AppRadioGroupProps<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function AppRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: AppRadioGroupProps<T>) {
  return (
    <View className={`${label ? "" : "mt-3"} ${className}`}>
      {label && (
        <AppLabel>
          {label}
        </AppLabel>
      )}
      <View
        className="flex-row flex-wrap gap-2 mb-1"
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              className={`items-center justify-center min-h-[44px] px-6 rounded-2xl border ${
                isSelected ? "bg-primary/15 border-primary" : "bg-surface border-border"
              }`}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
            >
              <AppText
                variant="body-bold"
                className={`text-sm ${isSelected ? "text-secondary" : "text-textPrimary"}`}
              >
                {opt.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
