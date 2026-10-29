import React from "react";
import { Image, View, Text, TouchableOpacity, type AccessibilityActionEvent } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { Ionicon } from "@/components/ui/Ionicon";
import { useAccounts } from "@/context/AccountContext";
import { resolveAccountLogo } from "@/utils/accountLogo/resolveAccountLogo";
import { formatAmount, nextOccurrence } from "@/utils/dateHelpers";
import { signedAmount } from "@/utils/signedAmount";
import { colors } from "@/constants/theme";
import { DEFAULT_CARD_COLOR } from "@/constants/cardColors";
import { findBank } from "@/constants/banks";
import { ACCOUNT_TYPE_LABEL, INTEREST_PERIOD_UNIT, type Account, type AccountType, type IoniconName } from "@/types";

interface Props {
  account: Account;
  index?: number;
  previewBalance?: number;
  onPress?: () => void;
  isCompact?: boolean;
  isStatic?: boolean;
  // Picker state: a white ring and a check mark on the chosen account.
  isSelected?: boolean;
}

const TYPE_META: Record<AccountType, { icon: IoniconName; chip: string }> = {
  debit: { icon: "wallet-outline", chip: "Debit" },
  cash: { icon: "cash-outline", chip: "Cash" },
  credit: { icon: "card-outline", chip: "Credit" },
};

const ACCESSIBILITY_ACTIONS = [
  { name: "adjust", label: "Adjust balance" },
  { name: "transfer", label: "Transfer" },
];

const CARD_ACCESSIBILITY_ACTIONS = [
  { name: "adjust", label: "Adjust balance" },
  { name: "transfer", label: "Pay bill" },
];

function wholeAmount(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export function AccountCard({
  account,
  index = 0,
  previewBalance,
  onPress,
  isCompact = false,
  isStatic = false,
  isSelected = false,
}: Props) {
  const { getBalance, interestEstimate } = useAccounts();
  const isReducedMotion = useReducedMotion();
  const meta = TYPE_META[account.type];
  const bank = findBank(account.bank);
  const isPreview = previewBalance != null;
  const isPressable = !isPreview && !isStatic;
  const balance = previewBalance ?? getBalance(account.id);
  const isCredit = account.type === "credit";
  const isNegative = !isCredit && balance < 0;
  const hasCreditBalance = isCredit && balance < 0;
  const amountText = hasCreditBalance ? `${formatAmount(-balance)} credit` : signedAmount(balance);

  const interest = account.type === "debit" && !isPreview ? interestEstimate(account) : null;
  const limit = isCredit ? account.creditLimit : null;
  const available = limit != null ? limit - balance : 0;
  const isOverLimit = limit != null && available < 0;
  const utilization = limit ? Math.min(Math.max(balance / limit, 0), 1) : isOverLimit ? 1 : 0;
  const isArchived = account.archivedAt != null;
  // Archived cards have no bills, so no due date either.
  const dueDate = isCredit && account.dueDay != null && !isArchived ? dayjs(nextOccurrence(account.dueDay)) : null;

  // Keep borderWidth explicit. On Android, removing it from this overflow-hidden view leaves NaN
  // border insets, and the padding-box clip then hides every child (issue #32).
  const borderClass = isSelected ? "border-2 border-white" : isNegative ? "border-2 border-overdue" : "border-0";

  const subtitle = [
    meta.chip,
    isArchived ? "Archived" : null,
    account.interestRate && !isArchived ? `${account.interestRate}% p.a.` : null,
    dueDate ? `due ${dueDate.format("MMM D")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const labelParts = [account.name, ACCOUNT_TYPE_LABEL[account.type].toLowerCase()];
  if (isArchived) {
    labelParts.push("archived");
  }
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
    if (interest) {
      labelParts.push(`earns ${formatAmount(interest.amount)} net interest per ${INTEREST_PERIOD_UNIT[interest.period].long}`);
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
      disabled={!isPressable}
      onPress={onPress ?? (() => router.push(`/account/${account.id}`))}
      accessibilityRole={isPressable ? "button" : undefined}
      accessibilityLabel={labelParts.join(", ")}
      accessibilityState={onPress ? { selected: isSelected } : undefined}
      accessibilityHint={!isPressable || onPress ? undefined : "Opens account details"}
      accessibilityActions={
        !isPressable || onPress ? undefined : isCredit ? CARD_ACCESSIBILITY_ACTIONS : ACCESSIBILITY_ACTIONS
      }
      onAccessibilityAction={handleAccessibilityAction}
    >
      <Animated.View
        entering={isReducedMotion || !isPressable ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}
        className={`grow rounded-3xl overflow-hidden justify-between ${isCompact ? "p-3" : "min-h-[164px] p-4"} ${borderClass}`}
        style={{ backgroundColor: account.color ?? DEFAULT_CARD_COLOR }}
      >
        {/* NativeWind has no gradient classes on native, so the sheen is an RN background image. */}
        <View
          pointerEvents="none"
          className="absolute inset-0"
          style={{ experimental_backgroundImage: "linear-gradient(rgba(255,255,255,0.14), rgba(0,0,0,0.3))" }}
        />

        <View>
          <View className="flex-row items-center gap-2.5">
            {account.logoUri ? (
              <Image source={{ uri: resolveAccountLogo(account.logoUri) }} className="size-9 rounded-xl bg-white" />
            ) : bank ? (
              <View className="size-9 rounded-xl items-center justify-center bg-white">
                <Image source={bank.logo} className="size-[24px]" />
              </View>
            ) : (
              <View className="size-9 rounded-xl items-center justify-center bg-white/20">
                <Ionicon name={account.icon ?? meta.icon} size={18} color={colors.text} />
              </View>
            )}
            <AppText variant="body-bold" className="flex-1" numberOfLines={1}>{account.name}</AppText>
            {isSelected && <Feather name="check-circle" size={18} color={colors.text} />}
          </View>
          <AppText variant="meta" className={`${isCompact ? "mt-1" : "mt-2"} text-white/75`} numberOfLines={1}>{subtitle}</AppText>
        </View>

        <View className={`${isCompact ? "mt-2" : "mt-4"} gap-1`}>
          {limit != null && (
            <>
              {!isCompact && (
                <View className="flex-row items-center gap-2">
                  <AppText variant="overline" className="text-white/75">Used credit</AppText>
                  <View className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden">
                    <View className="h-full rounded-full bg-white" style={{ width: `${utilization * 100}%` }} />
                  </View>
                </View>
              )}
              <View className="flex-row items-center justify-between gap-2">
                <AppText variant="meta" className="text-white/75" numberOfLines={1}>
                  {isOverLimit ? "Over limit" : `${Math.round(utilization * 100)}% used`}
                </AppText>
                <AppText variant="meta" className="text-white/75" numberOfLines={1}>
                  {isOverLimit ? `${wholeAmount(-available)} over` : `${wholeAmount(available)} left`}
                </AppText>
              </View>
            </>
          )}
          {limit == null && (
            <AppText variant="overline" className="text-white/75">
              {isNegative ? "Overdrawn" : isCredit && !hasCreditBalance ? "Owed" : "Balance"}
            </AppText>
          )}
          <View className="flex-row items-center gap-1.5">
            {(isNegative || isOverLimit) && <Feather name="alert-triangle" size={16} color={colors.text} />}
            {hasCreditBalance && <Feather name="check-circle" size={16} color={colors.text} />}
            <Text
              className={`flex-1 font-oswald text-white ${isCompact ? "text-[20px]" : "text-[24px]"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              maxFontSizeMultiplier={1.4}
            >
              {amountText}
            </Text>
          </View>
          {interest && !isCompact && (
            <View className="flex-row items-center gap-1">
              <Feather name="trending-up" size={12} color={colors.text} />
              <AppText variant="meta" className="text-white/85" numberOfLines={1}>{`+${formatAmount(interest.amount)}/${INTEREST_PERIOD_UNIT[interest.period].short}`}</AppText>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}
