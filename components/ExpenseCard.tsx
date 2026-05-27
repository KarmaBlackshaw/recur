import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
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
import type { Expense } from "../types";

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Housing: "home-outline",
  Utilities: "flash-outline",
  Subscriptions: "apps-outline",
  Insurance: "shield-checkmark-outline",
  Transport: "car-outline",
  Food: "restaurant-outline",
  Health: "medkit-outline",
  Other: "ellipsis-horizontal-circle-outline",
};

interface Props {
  expense: Expense;
  index?: number;
}

export function ExpenseCard({ expense, index = 0 }: Props) {
  const { toggleStatus, deleteExpense } = useExpenses();
  const swipeRef = useRef<Swipeable>(null);
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
    shadowRadius: interpolate(pulse.value, [0, 1], [4, 12]),
  }));

  function handleDelete() {
    swipeRef.current?.close();
    Alert.alert(
      "Delete expense",
      `Remove "${expense.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteExpense(expense.id),
        },
      ]
    );
  }

  function renderRightActions() {
    return (
      <TouchableOpacity
        className="bg-overdue justify-center items-center w-16 my-1 mr-4 rounded-xl"
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  const iconName =
    CATEGORY_ICONS[expense.category] ?? "ellipsis-horizontal-circle-outline";

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(300)}
        className={`flex-row items-center bg-surface rounded-xl mx-4 my-1 p-3 border border-border ${
          overdueFlag ? "border-l-[3px] border-l-overdue" : ""
        }`}
        style={[
          { shadowColor: overdueFlag ? "#DC2626" : "#000", shadowOffset: { width: 0, height: 2 }, elevation: 2 },
          overdueFlag && glowStyle,
        ]}
      >
        {/* Left: category icon */}
        <View className="w-9 h-9 rounded-[10px] bg-secondary/10 items-center justify-center mr-3">
          <Ionicons name={iconName} size={20} color="#3B82F6" />
        </View>

        {/* Middle: name + category + notes */}
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-white text-sm font-quicksand-bold shrink" numberOfLines={1}>
              {expense.name}
            </Text>
            <Text className="text-white/40 text-[10px] font-quicksand-medium bg-white/5 px-1.5 py-0.5 rounded">
              {expense.category}
            </Text>
          </View>
          {expense.notes ? (
            <Text className="text-white/45 text-[11px] font-quicksand" numberOfLines={1}>
              {expense.notes}
            </Text>
          ) : null}
          <Text className={`text-[11px] font-quicksand-medium mt-0.5 ${overdueFlag ? "text-overdue" : "text-white/40"}`}>
            {overdueFlag && (
              <Ionicons name="warning-outline" size={12} color="#DC2626" />
            )}{" "}
            {formatDue(expense.dueDay)}
          </Text>
        </View>

        {/* Right: amount + badge */}
        <View className="items-end gap-1.5 ml-2">
          <Text className="text-white text-[15px] font-caveat-bold">
            ₱{expense.amount.toFixed(2)}
          </Text>
          <StatusBadge
            status={expense.status}
            overdue={overdueFlag}
            onToggle={() => toggleStatus(expense.id)}
          />
        </View>
      </Animated.View>
    </Swipeable>
  );
}
