import React, { useRef } from "react";
import { View, TouchableOpacity, Alert, type AccessibilityActionEvent } from "react-native";
import { router } from "expo-router";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { StatusBadge } from "./StatusBadge";
import { AppText } from "./ui/AppText";
import dayjs from "dayjs";
import { formatDueDate, getDueDateForMonth, isOverdueOn, formatAmount, isEndedOn, formatEndMonth } from "../utils/dateHelpers";
import { useExpenses } from "../context/ExpenseContext";
import { expenseTitle } from "../utils/expenseHelpers";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

interface Props {
  expense: Expense;
  index?: number;
  referenceDate?: Date;
  onPress?: () => void;
  compact?: boolean;   // day-grouped paid ledger: drop icon, date line, and status badge (all items are paid)
  hideDate?: boolean;  // drop the date/due line only, keep status badge (recurring tab)
}

export function ExpenseCard({ expense, index = 0, referenceDate, onPress, compact = false, hideDate = false }: Props) {
  const { getMonthStatus, toggleMonthStatus, deleteExpense, getMonthAmount, getMonthPaidAt } = useExpenses();
  const swipeRef = useRef<SwipeableMethods>(null);
  const isReducedMotion = useReducedMotion();
  const refDate = referenceDate ?? new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const isRegular = expense.recurrence === "one-off";
  const dueDate = getDueDateForMonth(expense.dueDay, year, month);
  const resolvedStatus = getMonthStatus(expense.id, year, month);
  const isPaid = resolvedStatus === "paid";
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
  const amountText = displayAmount !== null ? formatAmount(displayAmount) : "TBD";
  const daysOverdue = dayjs().startOf("day").diff(dayjs(dueDate).startOf("day"), "day");
  const dateText = ended
    ? `Ended ${formatEndMonth(expense.endYear!, expense.endMonth!)}`
    : isRegular
      ? dayjs(expense.createdAt).format("MMM D")
      : isPaid
        ? dayjs(paidAt ?? dueDate).format("MMM D")
        : overdueFlag
          ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} late`
          : formatDueDate(dueDate);
  const statusLabel = ended ? "Ended" : isPaid ? "Paid" : overdueFlag ? "Overdue" : "Unpaid";
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
    if (nativeEvent.actionName === "toggle") handleToggle();
    if (nativeEvent.actionName === "delete") handleDelete();
  }

  const accessibilityActions = [
    ...(canToggle ? [{ name: "toggle", label: isPaid ? "Mark unpaid" : "Mark paid" }] : []),
    { name: "delete", label: "Delete" },
  ];

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
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress ?? (() => router.push({ pathname: "/expense/add", params: { id: expense.id } }))}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${expense.category}, ${amountText}, ${statusLabel}, ${dateText}`}
        accessibilityHint="Opens editor"
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <Animated.View
          entering={isReducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}
          className={`flex-row items-center rounded-2xl mx-5 my-1.5 px-4 py-3.5 border border-white/[0.07] ${
            overdueFlag ? "bg-overdue/[0.06] border-l-[3px] border-l-overdue" : "bg-surface"
          }`}
        >
          <View className="flex-1">
            <AppText
              variant="body-bold"
              className={`text-[15px] ${ended ? "text-textMuted" : ""}`}
              numberOfLines={1}
            >
              {title}
            </AppText>
            <View className="flex-row items-center gap-2 mt-1">
              <AppText variant="meta">{expense.category}</AppText>
              {expense.reminderDaysBefore != null && (
                <Feather name="bell" size={12} color={colors.secondary} />
              )}
              {!compact && !hideDate && (
                <AppText variant="meta" className={overdueFlag ? "text-overdue" : ended ? "text-textMuted" : ""}>
                  {dateText}
                </AppText>
              )}
            </View>
          </View>

          <View className="ml-3 items-end gap-1.5">
            <AppText variant="amount" numberOfLines={1}>{amountText}</AppText>
            {compact ? null : ended ? (
              <View className="px-2 py-0.5 rounded-md bg-white/[0.06]">
                <AppText variant="caption" className="uppercase tracking-wider">Ended</AppText>
              </View>
            ) : (
              <StatusBadge status={resolvedStatus} overdue={overdueFlag} onToggle={handleToggle} />
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}
