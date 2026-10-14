import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "../../constants/theme";

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
    <View className={className}>
      {label && (
        <AppText variant="label" className="mb-1.5 mt-1">
          {label}
        </AppText>
      )}
      <View
        className="flex-row bg-surface rounded-xl border border-border mb-1 overflow-hidden min-h-[52px]"
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              className={`flex-1 flex-row items-center justify-center gap-1 min-h-[52px] px-1 ${
                isSelected ? "bg-primary" : ""
              }`}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
            >
              {isSelected && <Feather name="check" size={12} color={colors.text} />}
              <AppText
                variant={isSelected ? "body-bold" : "body-medium"}
                className={`text-xs ${isSelected ? "text-white" : "text-textSecondary"}`}
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
