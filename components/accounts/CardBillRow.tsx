import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { StatusBadge } from "@/components/StatusBadge";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import type { CardBill } from "@/types";

interface Props {
  bill: CardBill;
  onPress: () => void;
}

export function CardBillRow({ bill, onPress }: Props) {
  const isOverdue = !bill.isPaid && dayjs(bill.dueDate).isBefore(dayjs().startOf("day"));
  const isPartial = bill.paid > 0 && !bill.isPaid;
  const title = `${bill.account.name} bill`;
  const due = dayjs(bill.dueDate);
  const meta = `${bill.isEstimate ? "Est. · " : ""}Due ${due.format("MMM D")}`;
  const leftText = `${formatAmount(bill.remaining)} left`;
  const badgeLabel = isPartial ? leftText : undefined;
  const stateText = [isOverdue ? "overdue" : "unpaid", isPartial ? leftText : undefined]
    .filter(Boolean)
    .join(", ");
  const a11yLabel = `${title}, ${formatAmount(bill.amount)}${bill.isEstimate ? " estimated" : ""}, due ${due.format("MMMM D")}, ${stateText}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens bill details"
    >
      <View
        className={`flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] ${
          isOverdue ? "bg-overdue/[0.06] border-l-[3px] border-l-overdue" : "bg-surface"
        }`}
      >
        <View className="w-10 h-10 rounded-xl bg-secondary/20 items-center justify-center mr-3">
          <Ionicons name="card-outline" size={20} color={colors.secondary} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[15px]" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="meta" className={`mt-1 ${isOverdue ? "text-overdue" : ""}`} numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <AppText variant="amount" numberOfLines={1}>{formatAmount(bill.amount)}</AppText>
          <StatusBadge status="unpaid" overdue={isOverdue} label={badgeLabel} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
