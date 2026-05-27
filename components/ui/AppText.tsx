import React from "react";
import { Text, TextProps } from "react-native";

type Variant = "heading" | "body" | "body-medium" | "body-bold" | "label" | "caption";

interface AppTextProps extends TextProps {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  heading:      "font-caveat-bold",
  body:         "font-quicksand",
  "body-medium":"font-quicksand-medium",
  "body-bold":  "font-quicksand-bold",
  label:        "font-quicksand-bold text-xs uppercase tracking-widest text-white/60",
  caption:      "font-quicksand text-xs text-white/40",
};

export function AppText({ variant = "body", className = "", ...props }: AppTextProps) {
  return <Text className={`${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}
