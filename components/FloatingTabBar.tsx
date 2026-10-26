import React, { useState } from "react";
import { View, Text, TouchableOpacity, Pressable, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import type { BottomTabBarProps } from "expo-router/tabs";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

const TAB_META: Record<string, { label: string; icon: FeatherIconName }> = {
  index: { label: "Home", icon: "home" },
  expenses: { label: "Activity", icon: "check-circle" },
  recurring: { label: "Recurring", icon: "repeat" },
  accounts: { label: "Accounts", icon: "credit-card" },
  loans: { label: "Loans", icon: "users" },
};

const FAB_TYPE: Record<string, "regular" | "recurring"> = {
  index: "regular",
  expenses: "regular",
  recurring: "recurring",
  accounts: "regular",
};

type QuickAction = "expense" | "income" | "transfer" | "loan";

const QUICK_ACTIONS: { key: QuickAction; label: string; icon: FeatherIconName }[] = [
  { key: "transfer", label: "Transfer", icon: "repeat" },
  { key: "income", label: "New income", icon: "arrow-down-left" },
  { key: "expense", label: "New expense", icon: "arrow-up-right" },
  { key: "loan", label: "New loan", icon: "users" },
];

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [tabHeight, setTabHeight] = useState(56);
  const activeRoute = state.routes[state.index];
  const activeName = activeRoute?.name ?? "index";
  const params = activeRoute?.params;
  const isIncomeSegment =
    activeName === "expenses" && params != null && "segment" in params && params.segment === "income";

  const fabType = FAB_TYPE[activeName] ?? "regular";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isReducedMotion = useReducedMotion();
  const fabBottom = insets.bottom + 12;
  const { fontScale, width } = useWindowDimensions();
  const isCompact = fontScale > 1.15 || width < 380;

  function getFabLabel() {
    if (isMenuOpen) {
      return "Close quick actions";
    }
    if (activeName === "loans") {
      return "Add loan";
    }
    if (isIncomeSegment) {
      return "Add income";
    }
    return fabType === "recurring" ? "Add recurring expense" : "Add expense";
  }
  const fabLabel = getFabLabel();

  function handleAdd() {
    if (activeName === "loans") {
      router.push("/loan/add");
      return;
    }
    if (isIncomeSegment) {
      router.push("/income/add");
      return;
    }
    router.push(`/expense/add?type=${fabType}`);
  }

  function runQuickAction(action: QuickAction) {
    setIsMenuOpen(false);
    if (action === "expense") {
      router.push("/expense/add?type=regular");
      return;
    }
    if (action === "income") {
      router.push("/income/add");
      return;
    }
    if (action === "loan") {
      router.push("/loan/add");
      return;
    }
    router.push("/transfer");
  }

  return (
    <>
      {isMenuOpen ? (
        <Animated.View
          entering={isReducedMotion ? undefined : FadeIn.duration(150)}
          exiting={isReducedMotion ? undefined : FadeOut.duration(150)}
          className="absolute inset-0"
        >
          <Pressable
            className="flex-1 bg-black/60"
            onPress={() => setIsMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close quick actions"
          />
          <View className="absolute right-5 items-end gap-3" style={{ bottom: fabBottom + tabHeight + 16 }}>
            {QUICK_ACTIONS.map((action, index) => (
              <Animated.View
                key={action.key}
                entering={isReducedMotion ? undefined : FadeInDown.delay((QUICK_ACTIONS.length - 1 - index) * 40).duration(200)}
              >
                <TouchableOpacity
                  onPress={() => runQuickAction(action.key)}
                  activeOpacity={0.85}
                  className="min-h-[48px] flex-row items-center gap-3 pl-5 pr-4 rounded-full bg-surface border border-border"
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <AppText variant="body-bold" className="text-sm">{action.label}</AppText>
                  <Feather name={action.icon} size={18} color={colors.secondary} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
      <View
        className="absolute left-0 right-0 flex-row items-center gap-3 px-5"
        style={{ bottom: fabBottom }}
        pointerEvents="box-none"
      >
        <View
          className="flex-1 flex-row items-center bg-surface rounded-3xl py-1.5 px-1.5 border border-border"
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
            const isLabelVisible = focused || !isCompact;
            const tabClass = `${isCompact && focused ? "flex-[1.8]" : "flex-1"} min-h-[44px] items-center py-2.5 rounded-[18px] ${focused ? "bg-primary/15" : ""}`;

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
                className={tabClass}
                accessibilityRole="tab"
                onLayout={focused ? (e) => setTabHeight(e.nativeEvent.layout.height) : undefined}
                accessibilityState={{ selected: focused }}
                accessibilityLabel={meta.label}
              >
                <Feather name={meta.icon} size={19} color={color} />
                {isLabelVisible ? (
                  <Text
                    className="text-[10px] mt-1"
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.3}
                    style={{ color, fontFamily: "Quicksand_700Bold" }}
                  >
                    {meta.label}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={isMenuOpen ? () => setIsMenuOpen(false) : handleAdd}
          onLongPress={() => setIsMenuOpen(true)}
          activeOpacity={0.85}
          className="rounded-[18px] bg-primary items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={fabLabel}
          accessibilityHint="Long press for more actions"
          accessibilityActions={[{ name: "longpress", label: "More actions" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "longpress") {
              setIsMenuOpen(true);
            }
          }}
          style={{
            width: tabHeight,
            height: tabHeight,
            shadowColor: colors.secondary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
            elevation: 10,
          }}
        >
          <Feather name={isMenuOpen ? "x" : "plus"} size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
    </>
  );
}
