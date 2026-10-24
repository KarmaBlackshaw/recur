import React, { useRef } from "react";
import { View, TouchableOpacity, Alert, type AccessibilityActionEvent } from "react-native";
import { router } from "expo-router";
import { Pressable } from "react-native-gesture-handler";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppListRow, type RowTone } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import dayjs from "dayjs";
import { formatDueDate, formatDaysLate, getDueDateForMonth, isOverdueOn, formatAmount, isEndedOn, formatEndMonth } from "@/utils/dateHelpers";
import { categoryIcon } from "@/utils/categories";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { colors } from "@/constants/theme";
import type { Expense } from "@/types";

interface Props {
  expense: Expense;
  index?: number;
  referenceDate?: Date;
  onPress?: () => void;
  compact?: boolean;   // ledger row under a day header: no pay toggle, caption only flags card-account status
  hideDate?: boolean;  // caption shows the status word instead of the date
}

export function ExpenseCard({ expense, index = 0, referenceDate, onPress, compact = false, hideDate = false }: Props) {
  const { getMonthStatus, toggleMonthStatus, deleteExpense, getMonthAmount, getMonthPaidAt } = useExpenses();
  const { accounts, isCharged, isCardAccount } = useAccounts();
  const accountName = accounts.find((a) => a.id === expense.accountId)?.name;
  const swipeRef = useRef<SwipeableMethods>(null);
  const isReducedMotion = useReducedMotion();
  const refDate = referenceDate ?? new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const isRegular = expense.recurrence === "one-off";
  const dueDate = getDueDateForMonth(expense.dueDay, year, month);
  const resolvedStatus = getMonthStatus(expense.id, year, month);
  const isPaid = resolvedStatus === "paid";
  const isChargedNow = isPaid && isCharged(expense.id, isRegular ? null : year, isRegular ? null : month);
  // Paid recurring shows when it was actually paid (paid_at), not its due date.
  // Fall back to dueDate only for legacy rows recorded before paid_at existed.
  const paidAt = !isRegular ? getMonthPaidAt(expense.id, year, month) : null;
  const ended = !isRegular && isEndedOn(expense.endYear, expense.endMonth, year, month);
  const overdueFlag = !isRegular && !ended && resolvedStatus === "unpaid" && isOverdueOn(expense.dueDay, year, month);
  const monthlyActual = getMonthAmount(expense.id, year, month);
  const displayAmount = expense.isVariable
    ? (monthlyActual !== null ? monthlyActual : null)
    : expense.amount;

  const title = expenseTitle(expense);
  const isCategoryTitle = title === expense.category;
  const amountText = displayAmount !== null ? formatAmount(displayAmount) : "TBD";
  const dateText = ended
    ? `Ended ${formatEndMonth(expense.endYear!, expense.endMonth!)}`
    : isRegular
      ? dayjs(expense.createdAt).format("MMM D")
      : isPaid
        ? dayjs(paidAt ?? dueDate).format("MMM D")
        : overdueFlag
          ? formatDaysLate(dueDate)
          : formatDueDate(dueDate);
  const statusLabel = ended ? "Ended" : isChargedNow ? "Charged" : isPaid ? "Paid" : overdueFlag ? "Overdue" : "Unpaid";
  // Settled captions stay neutral: the band or KPI already says "paid", and a mint caption on every
  // row would repeat it. Only card charges (indigo) and late dues (coral) get a tint.
  const statusTone: RowTone = ended ? "muted" : isChargedNow ? "accent" : overdueFlag ? "negative" : "neutral";
  // Ledger rows sit under a day header, so they only flag card-account status.
  const caption = compact || hideDate
    ? (!compact || isCardAccount(expense.accountId) ? statusLabel : undefined)
    : isPaid && !ended ? `${statusLabel} ${dateText}` : dateText;
  const canToggle = !compact && !ended;

  function handleToggle() {
    toggleMonthStatus(expense.id, year, month);
  }

  function handleDelete() {
    swipeRef.current?.close();
    Alert.alert("Delete expense", `Remove "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteExpense(expense.id),
      },
    ]);
  }

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "toggle") {
      handleToggle();
    }
    if (nativeEvent.actionName === "delete") {
      handleDelete();
    }
  }

  const accessibilityActions = [
    ...(canToggle ? [{ name: "toggle", label: isPaid ? "Mark unpaid" : "Mark paid" }] : []),
    { name: "delete", label: "Delete" },
  ];

  function handleSwipeToggle() {
    swipeRef.current?.close();
    handleToggle();
  }

  // RNGH Pressable, not TouchableOpacity: the swipeable's full-width right-actions layer sits on top
  // and swallows RN touches on the left side; RNGH's own hit-testing passes through it.
  function renderLeftActions() {
    return (
      <Pressable onPress={handleSwipeToggle} accessibilityRole="button" accessibilityLabel={isPaid ? "Mark unpaid" : "Mark paid"}>
        <View className="flex-1 justify-center items-center gap-1 w-20 my-1.5 ml-5 rounded-2xl bg-paid/15">
          <Feather name={isPaid ? "rotate-ccw" : "check"} size={20} color={colors.paid} />
          <AppText variant="meta" className="text-paid">{isPaid ? "Unpay" : "Pay"}</AppText>
        </View>
      </Pressable>
    );
  }

  function renderRightActions() {
    return (
      <TouchableOpacity
        className="justify-center items-center gap-1 w-20 my-1.5 mr-5 rounded-2xl bg-overdue/15"
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete"
      >
        <Feather name="trash-2" size={20} color={colors.overdue} />
        <AppText variant="meta" className="text-overdue">Delete</AppText>
      </TouchableOpacity>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderLeftActions={canToggle ? renderLeftActions : undefined}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
    >
      <Animated.View entering={isReducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
        <AppListRow
          icon={categoryIcon(expense.category)}
          iconTone={overdueFlag ? "negative" : "neutral"}
          title={title}
          meta={[isCategoryTitle ? null : expense.category, accountName].filter(Boolean).join(" · ") || undefined}
          metaIcon={expense.reminderDaysBefore != null ? "bell" : undefined}
          amount={amountText}
          caption={caption}
          captionTone={statusTone}
          isMuted={ended}
          onPress={onPress ?? (() => router.push({ pathname: "/expense/add", params: { id: expense.id } }))}
          accessibilityLabel={`${isCategoryTitle ? title : `${title}, ${expense.category}`}${accountName != null ? `, from ${accountName}` : ""}, ${amountText}, ${statusLabel}, ${dateText}`}
          accessibilityHint="Opens editor"
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={handleAccessibilityAction}
        />
      </Animated.View>
    </ReanimatedSwipeable>
  );
}
