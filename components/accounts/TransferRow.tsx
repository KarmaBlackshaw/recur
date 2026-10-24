import React from "react";
import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { TransferEntry } from "@/utils/usePaidLedger";

export function TransferRow({ entry }: { entry: TransferEntry }) {
  const { transfer, fromName, toName, amount, fee, earned, earnedCategory, earnedAccountName } = entry;
  const source = fromName ?? "Deleted account";
  const destination = toName ?? "Deleted account";
  const title = `${source} → ${destination}`;
  const isAutoNote = transfer.note === `Transfer to ${destination}` || transfer.note === `Transfer from ${source}`;
  const customNote = isAutoNote ? null : transfer.note;
  const earnedLabel =
    earned > 0
      ? [`income ${formatAmount(earned)}`, earnedAccountName && `to ${earnedAccountName}`, earnedCategory && `(${earnedCategory})`]
          .filter(Boolean)
          .join(" ")
      : null;
  const meta = [customNote, fee > 0 ? `fee ${formatAmount(fee)}` : null, earnedLabel].filter(Boolean).join(" · ") || "Transfer";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: "/account/[id]", params: { id: transfer.accountId } })}
      accessibilityRole="button"
      accessibilityLabel={`Transfer from ${source} to ${destination}, ${formatAmount(amount)}, ${meta}`}
      accessibilityHint="Opens account details"
    >
      <View className="flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] bg-surface">
        <View className="w-10 h-10 rounded-xl bg-white/[0.07] items-center justify-center mr-3">
          <Feather name="repeat" size={18} color={colors.textSecondary} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="meta" className="mt-1" numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <AppText variant="amount" className="ml-3 text-textSecondary" numberOfLines={1}>
          {formatAmount(amount)}
        </AppText>
      </View>
    </TouchableOpacity>
  );
}
