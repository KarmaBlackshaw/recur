import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export function AppCheckRow({ label, description, checked, onToggle }: Props) {
  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 bg-surface border border-border rounded-xl px-3.5 py-3 mb-1 mt-1 min-h-[52px]"
      onPress={() => onToggle(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={description}
    >
      <View
        className={`w-5 h-5 rounded border-2 items-center justify-center ${checked ? "border-primary bg-primary" : "border-textMuted"}`}
      >
        {checked && <Feather name="check" size={12} color={colors.text} />}
      </View>
      <View className="flex-1">
        <AppText variant="body-medium" className="text-sm">{label}</AppText>
        {description && <AppText variant="meta">{description}</AppText>}
      </View>
    </TouchableOpacity>
  );
}
