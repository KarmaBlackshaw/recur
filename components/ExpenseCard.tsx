import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
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
import { formatDue, isOverdue } from "../utils/dateHelpers";
import { useExpenses } from "../context/ExpenseContext";
import { colors } from "../constants/theme";
import type { Expense } from "../types";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Housing: "home",
  Utilities: "zap",
  Subscriptions: "grid",
  Insurance: "shield",
  Transport: "truck",
  Food: "coffee",
  Health: "heart",
  Other: "more-horizontal",
};

interface Props {
  expense: Expense;
  index?: number;
}

export function ExpenseCard({ expense, index = 0 }: Props) {
  const { toggleStatus, deleteExpense } = useExpenses();
  const swipeRef = useRef<SwipeableMethods>(null);
  const overdueFlag = isOverdue(expense.dueDay) && expense.status === "unpaid";

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
    Alert.alert("Delete expense", `Remove "${expense.name}"?`, [
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
        className="bg-overdue justify-center items-center w-16 my-1.5 mr-4 rounded-2xl"
        onPress={handleDelete}
        accessibilityLabel="Delete expense"
      >
        <Feather name="trash-2" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  const iconName =
    CATEGORY_ICONS[expense.category] ?? "more-horizontal";

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(300)}
        className="flex-row items-center bg-surface rounded-2xl mx-4 my-1.5 px-4 py-3.5 border border-white/[0.07]"
        style={[
          styles.shadow,
          overdueFlag ? styles.shadowOverdue : null,
          overdueFlag ? { borderLeftWidth: 3, borderLeftColor: colors.overdue } : null,
          overdueFlag ? glowStyle : null,
        ]}
      >
        {/* Category icon bubble */}
        <View
          className="w-11 h-11 rounded-xl items-center justify-center mr-3.5"
          style={{ backgroundColor: overdueFlag ? "rgba(248,113,113,0.12)" : "rgba(99,102,241,0.12)" }}
        >
          <Feather
            name={iconName}
            size={22}
            color={overdueFlag ? colors.overdue : colors.secondary}
          />
        </View>

        {/* Name + meta */}
        <View className="flex-1">
          <Text
            className="text-white text-[15px] font-['Quicksand_700Bold'] mb-0.5"
            numberOfLines={1}
          >
            {expense.name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-white/40 text-[10px] font-['Quicksand_500Medium'] bg-white/[0.06] px-2 py-0.5 rounded-md">
              {expense.category}
            </Text>
            {expense.status !== "paid" && (
              <Text
                className={`text-[11px] font-['Quicksand_500Medium'] ${overdueFlag ? "text-overdue" : "text-white/35"}`}
              >
                {overdueFlag ? "⚠ " : ""}{formatDue(expense.dueDay)}
              </Text>
            )}
          </View>
          {expense.notes ? (
            <Text
              className="text-white/30 text-[11px] font-['Quicksand_400Regular'] mt-1"
              numberOfLines={1}
            >
              {expense.notes}
            </Text>
          ) : null}
        </View>

        {/* Amount + status */}
        <View className="items-end gap-2 ml-3">
          <Text className="text-white text-[17px] leading-tight" style={{ fontFamily: "Oswald_Regular" }}>
            ₱{expense.amount.toFixed(2)}
          </Text>
          <StatusBadge
            status={expense.status}
            overdue={overdueFlag}
            onToggle={() => toggleStatus(expense.id)}
          />
        </View>
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  shadowOverdue: {
    shadowColor: "#F87171",
  },
});
