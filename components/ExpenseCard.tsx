import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
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
import { colors } from "../constants/theme";

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

  // Pulse glow for overdue
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
      <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
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
        style={[
          styles.card,
          overdueFlag && styles.cardOverdue,
          overdueFlag && glowStyle,
        ]}
      >
        {/* Left: category icon */}
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={20} color={colors.secondary} />
        </View>

        {/* Middle: name + category + notes */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {expense.name}
            </Text>
            <Text style={styles.categoryTag}>{expense.category}</Text>
          </View>
          {expense.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {expense.notes}
            </Text>
          ) : null}
          <Text style={[styles.due, overdueFlag && styles.dueOverdue]}>
            {overdueFlag && (
              <Ionicons name="warning-outline" size={12} color={colors.overdue} />
            )}{" "}
            {formatDue(expense.dueDay)}
          </Text>
        </View>

        {/* Right: amount + badge */}
        <View style={styles.right}>
          <Text style={styles.amount}>₱{expense.amount.toFixed(2)}</Text>
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

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: "#DC2626",
    shadowColor: "#DC2626",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Quicksand_700Bold",
    flexShrink: 1,
  },
  categoryTag: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontFamily: "Quicksand_500Medium",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notes: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Quicksand_400Regular",
  },
  due: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Quicksand_500Medium",
    marginTop: 2,
  },
  dueOverdue: {
    color: "#DC2626",
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  amount: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Caveat_700Bold",
  },
  deleteAction: {
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    width: 64,
    marginVertical: 4,
    marginRight: 16,
    borderRadius: 12,
  },
});
