import React from "react";
import { Text, TextProps, StyleProp, TextStyle } from "react-native";

type Variant = "heading" | "body" | "body-medium" | "body-bold" | "label" | "caption";

interface AppTextProps extends TextProps {
  variant?: Variant;
}

const VARIANT_STYLE: Record<Variant, { className: string; fontFamily: string }> = {
  heading:       { className: "",                                          fontFamily: "Oswald_Bold" },
  body:          { className: "",                                          fontFamily: "Quicksand_400Regular" },
  "body-medium": { className: "",                                          fontFamily: "Quicksand_500Medium" },
  "body-bold":   { className: "",                                          fontFamily: "Quicksand_700Bold" },
  label:         { className: "text-xs uppercase tracking-widest text-white/60", fontFamily: "Quicksand_700Bold" },
  caption:       { className: "text-xs text-white/40",                    fontFamily: "Quicksand_400Regular" },
};

export function AppText({ variant = "body", className = "", style, ...props }: AppTextProps) {
  const v = VARIANT_STYLE[variant];
  return (
    <Text
      className={`${v.className} ${className}`}
      style={[{ fontFamily: v.fontFamily }, style as StyleProp<TextStyle>]}
      {...props}
    />
  );
}
