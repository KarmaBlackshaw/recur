import React, { type ReactNode } from "react";
import { Keyboard, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

interface AppDisclosureCardProps {
  title: string;
  description?: string;
  summary?: string;
  summaryClassName?: string;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function AppDisclosureCard({
  title,
  description,
  summary,
  summaryClassName = "text-secondary",
  isOpen,
  onToggle,
  children,
  className = "",
}: AppDisclosureCardProps) {
  function toggle() {
    if (isOpen) {
      Keyboard.dismiss();
    }
    onToggle(!isOpen);
  }

  return (
    <View className={`bg-surface border border-border rounded-xl mt-3 mb-1 ${className}`}>
      <TouchableOpacity
        className="flex-row items-center gap-3 px-3.5 py-3 min-h-[52px]"
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        accessibilityHint={isOpen ? "Collapses the section" : "Expands the section"}
      >
        <View className="flex-1">
          <AppText variant="body-medium" className="text-sm">{title}</AppText>
          {description && !isOpen && <AppText variant="meta">{description}</AppText>}
        </View>
        {summary && (
          <AppText variant="body-medium" className={`text-sm ${summaryClassName}`}>{summary}</AppText>
        )}
        <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      <View className={isOpen ? "border-t border-border px-3.5 pt-2 pb-3.5" : "hidden"}>{children}</View>
    </View>
  );
}
