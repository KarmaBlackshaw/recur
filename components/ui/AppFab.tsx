import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

interface AppFabProps extends TouchableOpacityProps {
  icon: FeatherIconName;
  size?: number;
}

export function AppFab({ icon, size = 56, className = "", style, ...props }: AppFabProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className={`rounded-[18px] bg-primary items-center justify-center ${className}`}
      accessibilityRole="button"
      {...props}
      style={[
        {
          width: size,
          height: size,
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 10,
        },
        style,
      ]}
    >
      <Feather name={icon} size={26} color={colors.text} />
    </TouchableOpacity>
  );
}
