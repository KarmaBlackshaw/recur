import React from "react";
import { View, Text, TouchableOpacity, type AccessibilityActionEvent } from "react-native";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { formatAmount, nextOccurrence } from "@/utils/dateHelpers";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";
import { ACCOUNT_TYPE_LABEL, type Account, type AccountType, type IoniconName } from "@/types";

interface Props {
  account: Account;
  index?: number;
}

const TYPE_META: Record<AccountType, { icon: IoniconName; tile: string; iconColor: string; chip: string }> = {
  debit: { icon: "wallet-outline", tile: "bg-primary/20", iconColor: colors.secondary, chip: "Debit" },
  cash: { icon: "cash-outline", tile: "bg-white/[0.07]", iconColor: colors.textSecondary, chip: "Cash" },
  credit: { icon: "card-outline", tile: "bg-secondary/20", iconColor: colors.secondary, chip: "Credit" },
};

const ACCESSIBILITY_ACTIONS = [
  { name: "adjust", label: "Adjust balance" },
  { name: "transfer", label: "Transfer" },
];

function wholeAmount(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export function AccountCard({ account, index = 0 }: Props) {
  const { getBalance, monthlyInterestEstimate } = useAccounts();
  const isReducedMotion = useReducedMotion();
  const meta = TYPE_META[account.type];
  const balance = getBalance(account.id);
  const isCredit = account.type === "credit";
  const isNegative = !isCredit && balance < 0;
  const hasCreditBalance = isCredit && balance < 0;
  const amountText = hasCreditBalance ? `${formatAmount(-balance)} credit` : signedAmount(balance);

  const interest = account.type === "debit" ? monthlyInterestEstimate(account) : 0;
  const limit = isCredit ? account.creditLimit : null;
  const available = limit != null ? limit - balance : 0;
  const isOverLimit = limit != null && available < 0;
  const utilization = limit ? Math.min(Math.max(balance / limit, 0), 1) : isOverLimit ? 1 : 0;
  const dueDate = isCredit && account.dueDay != null ? dayjs(nextOccurrence(account.dueDay)) : null;

  const labelParts = [account.name, ACCOUNT_TYPE_LABEL[account.type].toLowerCase()];
  if (isCredit) {
    const owedText = hasCreditBalance ? `credit balance ${formatAmount(-balance)}` : `owed ${amountText}`;
    labelParts.push(limit != null ? `${owedText} of ${formatAmount(limit)} limit` : owedText);
    if (isOverLimit) {
      labelParts.push(`over limit by ${formatAmount(-available)}`);
    } else if (limit != null) {
      labelParts.push(`${formatAmount(available)} available`);
    }
    if (dueDate) {
      labelParts.push(`due ${dueDate.format("MMMM D")}`);
    }
  } else {
    labelParts.push(`balance ${amountText}`);
    if (interest > 0) {
      labelParts.push(`earns ${formatAmount(interest)} net interest per month`);
    }
    if (isNegative) {
      labelParts.push(`overdrawn by ${formatAmount(-balance)}`);
    }
  }

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    router.push({ pathname: "/account/[id]", params: { id: account.id, action: nativeEvent.actionName } });
  }

  return (
    <TouchableOpacity
      className="flex-1"
      activeOpacity={0.85}
      onPress={() => router.push(`/account/${account.id}`)}
      accessibilityRole="button"
      accessibilityLabel={labelParts.join(", ")}
      accessibilityHint="Opens account details"
      accessibilityActions={ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <Animated.View
        entering={isReducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}
        className={`flex-1 min-h-[148px] rounded-2xl p-3.5 border justify-between ${
          isNegative ? "bg-overdue/[0.06] border-overdue/30" : "bg-surface border-white/[0.07]"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className={`w-8 h-8 rounded-xl items-center justify-center ${meta.tile}`}>
            <Ionicons name={meta.icon} size={16} color={meta.iconColor} />
          </View>
          <AppText variant="caption" className="uppercase tracking-wider">{meta.chip}</AppText>
        </View>

        <AppText variant="body-bold" className="mt-2" numberOfLines={1}>{account.name}</AppText>

        <View>
          {isCredit && <AppText variant="overline">{hasCreditBalance ? "Balance" : "Owed"}</AppText>}
          <View className="flex-row items-center gap-1.5">
            {isNegative && <Feather name="alert-triangle" size={14} color={colors.overdue} />}
            {hasCreditBalance && <Feather name="check-circle" size={14} color={colors.paid} />}
            <Text
              className={`flex-1 text-[20px] font-oswald ${
                isNegative ? "text-overdue" : hasCreditBalance ? "text-paid" : "text-white"
              }`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.4}
            >
              {amountText}
            </Text>
          </View>
        </View>

        <View className="min-h-[32px] justify-end gap-0.5">
          {interest > 0 && (
            <View className="flex-row items-center gap-1">
              <Feather name="trending-up" size={12} color={colors.paid} />
              <AppText variant="meta" className="text-paid" numberOfLines={1}>{`+${formatAmount(interest)}/mo`}</AppText>
            </View>
          )}
          {limit != null && (
            <>
              <View className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                <View
                  className={`h-full rounded-full ${isOverLimit ? "bg-overdue" : "bg-secondary"}`}
                  style={{ width: `${utilization * 100}%` }}
                />
              </View>
              {isOverLimit ? (
                <View className="flex-row items-center gap-1">
                  <Feather name="alert-triangle" size={12} color={colors.overdue} />
                  <AppText variant="meta" className="text-overdue" numberOfLines={1}>{`${wholeAmount(-available)} over limit`}</AppText>
                </View>
              ) : (
                <AppText variant="meta" numberOfLines={1}>
                  {balance <= 0 ? `${wholeAmount(available)} avail` : `${wholeAmount(available)} left`}
                </AppText>
              )}
            </>
          )}
          {dueDate && <AppText variant="meta" numberOfLines={1}>{`Due ${dueDate.format("MMM D")}`}</AppText>}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}
