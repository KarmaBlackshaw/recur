import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { StatusBadge } from "./StatusBadge";
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
  const refDate = referenceDate ?? new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const isRegular = expense.recurrence === "one-off";
  const dueDate = getDueDateForMonth(expense.dueDay, year, month);
  const resolvedStatus = getMonthStatus(expense.id, year, month);
  // Paid recurring shows when it was actually paid (paid_at), not its due date.
  // Fall back to dueDate only for legacy rows recorded before paid_at existed.
  const paidAt = !isRegular ? getMonthPaidAt(expense.id, year, month) : null;
  const ended = !isRegular && isEndedOn(expense.endYear, expense.endMonth, year, month);
  const overdueFlag = !isRegular && !ended && resolvedStatus === "unpaid" && isOverdueOn(expense.dueDay, year, month);
  const monthlyActual = getMonthAmount(expense.id, year, month);
  const displayAmount = expense.isVariable
    ? (monthlyActual !== null ? monthlyActual : null)
    : expense.amount;

  const pulse = useSharedValue(0);
  React.useEffect(() => {
    if (overdueFlag) {
      pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
    } else {
      pulse.value = 0;
    }
  }, [overdueFlag]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.1, 0.45]),
    shadowRadius: interpolate(pulse.value, [0, 1], [4, 14]),
  }));

  function handleDelete() {
    swipeRef.current?.close();
    Alert.alert("Delete expense", `Remove "${expenseTitle(expense)}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteExpense(expense.id),
      },
    ]);
  }

  function renderRightActions() {
    return (
      <TouchableOpacity
        className="justify-center items-center w-16 my-1.5 mr-4"
        onPress={handleDelete}
        accessibilityLabel="Delete expense"
      >
        <Feather name="trash-2" size={20} color={colors.overdue} />
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
        accessibilityLabel="Edit expense"
      >
        <Animated.View
          entering={FadeInDown.delay(index * 60).duration(300)}
          className="flex-row items-center bg-surface rounded-2xl mx-4 my-1.5 px-4 py-3.5 border border-white/[0.07]"
          style={[
            {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 6,
              elevation: 3,
            },
            overdueFlag ? { shadowColor: "#F87171" } : null,
            overdueFlag ? { borderLeftWidth: 3, borderLeftColor: colors.overdue } : null,
            overdueFlag ? glowStyle : null,
            ended ? { opacity: 0.5 } : null,
          ]}
        >
        {/* Name + meta */}
        <View className="flex-1">
          <Text
            className="text-white text-[15px] font-['Quicksand_700Bold'] mb-0.5"
            numberOfLines={1}
          >
            {expenseTitle(expense)}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-white/40 text-[10px] font-['Quicksand_500Medium'] bg-white/[0.06] px-2 py-0.5 rounded-md">
              {expense.category}
            </Text>
            {expense.reminderDaysBefore != null && (
              <Feather name="bell" size={10} color={colors.secondary} style={{ marginTop: 2 }} />
            )}
          </View>
          {!compact && !hideDate && (
            <Text
              className={`text-[11px] font-['Quicksand_500Medium'] mt-0.5 ${overdueFlag ? "text-overdue" : "text-white/35"}`}
            >
              {ended
                ? `Ended ${formatEndMonth(expense.endYear!, expense.endMonth!)}`
                : isRegular
                  ? dayjs(expense.createdAt).format("MMM D")
                  : resolvedStatus === "paid"
                    ? dayjs(paidAt ?? dueDate).format("MMM D")
                    : `${overdueFlag ? "⚠ " : ""}${formatDueDate(dueDate)}`}
            </Text>
          )}
        </View>

        {/* Amount + status */}
        <View className="items-end gap-2 ml-3">
          <Text className="text-white text-[17px] leading-tight" style={{ fontFamily: "Oswald_Regular" }}>
            {displayAmount !== null ? formatAmount(displayAmount) : "TBD"}
          </Text>
          {compact ? null : ended ? (
            <View className="px-2 py-1 rounded-md bg-white/[0.06]">
              <Text className="text-white/40 text-[10px] font-['Quicksand_700Bold'] uppercase tracking-wider">Ended</Text>
            </View>
          ) : (
            <StatusBadge
              status={resolvedStatus}
              overdue={overdueFlag}
              onToggle={() => toggleMonthStatus(expense.id, year, month)}
            />
          )}
        </View>
      </Animated.View>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}
