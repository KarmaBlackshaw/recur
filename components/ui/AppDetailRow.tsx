import React from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AMOUNT_TONE, type RowTone } from "@/components/ui/AppListRow";
import { colors } from "@/constants/theme";

interface AppDetailRowProps {
  label: string;
  value: string;
  tone?: RowTone;
  onPress?: () => void;
}

const ROW_CLASS = "flex-row justify-between gap-4 py-1.5";

export function AppDetailRow({ label, value, tone = "neutral", onPress }: AppDetailRowProps) {
  const content = (
    <>
      <AppText variant="meta">{label}</AppText>
      <View className="shrink flex-row items-center gap-1">
        <AppText variant="body-medium" className={`shrink text-right ${AMOUNT_TONE[tone]}`}>{value}</AppText>
        {onPress && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
      </View>
    </>
  );

  if (!onPress) {
    return <View className={ROW_CLASS}>{content}</View>;
  }

  return (
    <TouchableOpacity className={ROW_CLASS} onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }}>
      {content}
    </TouchableOpacity>
  );
}
