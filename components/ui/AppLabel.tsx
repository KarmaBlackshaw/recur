import React from "react";
import { TextProps } from "react-native";
import { AppText } from "@/components/ui/AppText";

export function AppLabel({ className = "", ...props }: TextProps) {
  return <AppText variant="label" className={`mb-1.5 mt-1 ${className}`} {...props} />;
}
