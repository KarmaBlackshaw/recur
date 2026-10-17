import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { colors } from "../constants/theme";
import type { FeatherIconName } from "../types";

const TAB_META: Record<string, { label: string; icon: FeatherIconName }> = {
  index: { label: "Home", icon: "home" },
  expenses: { label: "Expenses", icon: "check-circle" },
  recurring: { label: "Recurring", icon: "repeat" },
};

const FAB_TYPE: Record<string, "regular" | "recurring"> = {
  index: "regular",
  expenses: "regular",
  recurring: "recurring",
};

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name ?? "index";

  const fabType = FAB_TYPE[activeName] ?? "regular";

  function handleAdd() {
    router.push(`/expense/add?type=${fabType}`);
  }

  return (
    <View
      className="absolute left-0 right-0 flex-row items-center gap-3 px-5"
      style={{ bottom: insets.bottom + 12 }}
      pointerEvents="box-none"
    >
      <View
        className="flex-1 flex-row items-center bg-surface rounded-full py-1.5 px-1.5 border border-border"
        accessibilityRole="tablist"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) {
            return null;
          }
          const focused = state.index === index;
          const color = focused ? colors.secondary : colors.textSecondary;

          function onPress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              className={`flex-1 items-center py-1.5 rounded-full ${focused ? "bg-primary/15" : ""}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              <Feather name={meta.icon} size={19} color={color} />
              <Text
                className="text-xs mt-0.5 tracking-wide"
                style={{ color, fontFamily: "Quicksand_700Bold" }}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={handleAdd}
        activeOpacity={0.85}
        className="size-14 rounded-full bg-primary items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={fabType === "recurring" ? "Add recurring expense" : "Add expense"}
        style={{
          shadowColor: colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        <Feather name="plus" size={26} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}
