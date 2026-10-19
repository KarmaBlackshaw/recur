import React from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { BillPaymentEntry } from "@/utils/usePaidLedger";

interface Props {
  entry: BillPaymentEntry;
}

export function BillPaymentRow({ entry }: Props) {
  const { account, sourceName, amount } = entry;
  const title = `${account.name} bill`;
  const meta = sourceName ? `from ${sourceName}` : "Bill payment";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: "/account/[id]", params: { id: account.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title} payment, ${formatAmount(amount)}, ${meta}`}
      accessibilityHint="Opens account details"
    >
      <View className="flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] bg-surface">
        <View className="w-10 h-10 rounded-xl bg-secondary/20 items-center justify-center mr-3">
          <Ionicons name="card-outline" size={20} color={colors.secondary} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="meta" className="mt-1" numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <AppText variant="amount" className="ml-3" numberOfLines={1}>
          {formatAmount(amount)}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}
