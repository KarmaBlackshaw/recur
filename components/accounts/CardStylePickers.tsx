import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { CARD_COLORS } from "@/constants/cardColors";
import { colors } from "@/constants/theme";
import { resolveAccountLogo } from "@/utils/accountLogo/resolveAccountLogo";
import type { IoniconName } from "@/types";

const CARD_ICONS: IoniconName[] = [
  "wallet-outline",
  "card-outline",
  "cash-outline",
  "business-outline",
  "phone-portrait-outline",
  "briefcase-outline",
  "home-outline",
  "cart-outline",
  "diamond-outline",
  "globe-outline",
];

interface PickerProps<T> {
  value: T;
  onChange: (value: T) => void;
}

export function CardColorPicker({ value, onChange }: PickerProps<string>) {
  return (
    <View className="mb-4">
      <AppLabel>Card color</AppLabel>
      <View className="flex-row flex-wrap gap-3">
        {CARD_COLORS.map((color) => {
          const isSelected = color === value;
          return (
            <TouchableOpacity
              key={color}
              onPress={() => onChange(color)}
              className={`size-11 rounded-xl items-center justify-center ${isSelected ? "border-2 border-white" : ""}`}
              style={{ backgroundColor: color }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Color ${color}`}
            >
              {isSelected && <Feather name="check" size={18} color={colors.text} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function CardIconPicker({ value, onChange }: PickerProps<IoniconName>) {
  return (
    <View className="mb-4">
      <AppLabel>Icon</AppLabel>
      <View className="flex-row flex-wrap gap-3">
        {CARD_ICONS.map((icon) => {
          const isSelected = icon === value;
          return (
            <TouchableOpacity
              key={icon}
              onPress={() => onChange(icon)}
              className={`size-11 rounded-xl items-center justify-center ${isSelected ? "bg-primary" : "bg-surface"}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={icon.replace("-outline", "").replace("-", " ")}
            >
              <Ionicons name={icon} size={20} color={isSelected ? colors.text : colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function CardLogoPicker({ value, onChange }: PickerProps<string | null>) {
  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) {
      return;
    }
    onChange(result.assets[0].uri);
  }

  return (
    <View className="mb-4">
      <AppLabel>Logo</AppLabel>
      <TouchableOpacity
        onPress={pickLogo}
        className="bg-surface border border-border rounded-xl px-4 min-h-[52px] flex-row items-center gap-3"
        accessibilityRole="button"
        accessibilityLabel={value ? "Change logo" : "Upload logo"}
      >
        {value && <Image source={{ uri: resolveAccountLogo(value) }} className="size-8 rounded-lg bg-white" />}
        <AppText variant="body-medium" className={`flex-1 text-[15px] ${value ? "text-white" : "text-textMuted"}`}>
          {value ? "Change logo" : "Upload logo"}
        </AppText>
        {value ? (
          <TouchableOpacity
            onPress={() => onChange(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Remove logo"
          >
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <Feather name="image" size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>
      <AppText variant="meta" className="mt-1.5">Replaces the icon on the card</AppText>
    </View>
  );
}
