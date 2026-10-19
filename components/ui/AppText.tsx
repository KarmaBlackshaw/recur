import React from "react";
import { Text, TextProps, StyleProp, TextStyle } from "react-native";
import { twMerge } from "tailwind-merge";

type Variant =
  | "display"
  | "title"
  | "heading"
  | "amount"
  | "amount-sm"
  | "body"
  | "body-medium"
  | "body-bold"
  | "label"
  | "overline"
  | "meta"
  | "caption";

interface AppTextProps extends TextProps {
  variant?: Variant;
}

const VARIANT_STYLE: Record<Variant, { className: string; fontFamily: string }> = {
  display:       { className: "text-[28px] text-white",                    fontFamily: "Oswald_Medium" },
  title:         { className: "text-[22px] text-white",                    fontFamily: "Oswald_Medium" },
  amount:        { className: "text-[17px] text-white",                    fontFamily: "Oswald_Regular" },
  "amount-sm":   { className: "text-[13px] text-textSecondary",            fontFamily: "Oswald_Medium" },
  heading:       { className: "text-white",                                fontFamily: "Oswald_Bold" },
  body:          { className: "text-white",                                fontFamily: "Quicksand_400Regular" },
  "body-medium": { className: "text-white",                                fontFamily: "Quicksand_500Medium" },
  "body-bold":   { className: "text-white",                                fontFamily: "Quicksand_700Bold" },
  label:         { className: "text-[11px] text-textMuted opacity-80",   fontFamily: "Quicksand_700Bold" },
  overline:      { className: "text-xs uppercase tracking-widest text-textSecondary", fontFamily: "Quicksand_700Bold" },
  meta:          { className: "text-xs text-textSecondary",               fontFamily: "Quicksand_500Medium" },
  caption:       { className: "text-xs text-textMuted",                   fontFamily: "Quicksand_400Regular" },
};

export function AppText({
  variant = "body",
  className = "",
  style,
  maxFontSizeMultiplier = 1.4,
  ...props
}: AppTextProps) {
  const v = VARIANT_STYLE[variant];
  return (
    <Text
      className={twMerge(v.className, className)}
      style={[{ fontFamily: v.fontFamily }, style as StyleProp<TextStyle>]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    />
  );
}
