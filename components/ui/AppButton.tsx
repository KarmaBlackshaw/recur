import React from "react";
import { ActivityIndicator, TouchableOpacity, TouchableOpacityProps } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

type Variant = "primary" | "tonal" | "ghost" | "destructive";

interface AppButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

const VARIANT: Record<Variant, { container: string; text: string; spinner: string }> = {
  primary:     { container: "bg-primary",                                text: "text-white",         spinner: colors.text },
  tonal:       { container: "bg-primary/15",                             text: "text-secondary",     spinner: colors.secondary },
  ghost:       { container: "border border-border",                      text: "text-textSecondary", spinner: colors.textSecondary },
  destructive: { container: "border border-overdue/40 bg-overdue/10",    text: "text-overdue",       spinner: colors.overdue },
};

export function AppButton({
  label,
  variant = "primary",
  disabled,
  loading = false,
  className = "",
  ...props
}: AppButtonProps) {
  const v = VARIANT[variant];
  const isInactive = Boolean(disabled) || loading;

  return (
    <TouchableOpacity
      className={`rounded-xl min-h-[52px] px-4 items-center justify-center ${v.container} ${disabled ? "opacity-40" : ""} ${className}`}
      disabled={isInactive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <AppText variant="body-bold" className={`text-sm ${v.text}`}>{label}</AppText>
      )}
    </TouchableOpacity>
  );
}
