import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { AppText } from "./AppText";

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
      <View className="flex-row bg-surface rounded-[10px] border border-border mb-1 overflow-hidden h-[52px]">
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            className={`flex-1 items-center justify-center ${
              value === opt.value ? "bg-primary" : ""
            }`}
            onPress={() => onChange(opt.value)}
          >
            <Text
              className={`text-xs ${
                value === opt.value
                  ? "text-white font-quicksand-bold"
                  : "text-white/50 font-quicksand-medium"
              }`}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
