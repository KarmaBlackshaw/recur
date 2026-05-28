import React from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import { AppText } from "./AppText";

type Variant = "primary" | "ghost" | "destructive";

interface AppButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:     "bg-primary rounded-xl h-[52px] items-center justify-center",
  ghost:       "rounded-xl h-[52px] items-center justify-center border border-white/10",
  destructive: "bg-overdue rounded-xl h-[52px] items-center justify-center",
};

export function AppButton({ label, variant = "primary", disabled, className = "", ...props }: AppButtonProps) {
  return (
    <TouchableOpacity
      className={`${VARIANT_CLASS[variant]} ${disabled ? "opacity-40" : ""} ${className}`}
      disabled={disabled}
      {...props}
    >
      <AppText variant="body-bold" className="text-white text-sm">{label}</AppText>
    </TouchableOpacity>
  );
}
