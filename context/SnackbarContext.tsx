import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/AppText";

const VISIBLE_MS = 5000;
// Clears the floating tab bar (its bottom inset + 12dp gap + ~60dp bar) with room to spare.
const TAB_BAR_CLEARANCE = 88;

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface SnackbarContextValue {
  show: (options: SnackbarOptions) => void;
  hide: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const isReducedMotion = useReducedMotion();

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, []);

  const show = useCallback((options: SnackbarOptions) => {
    clearTimer();
    setCurrent({ ...options, key: Date.now() });
    AccessibilityInfo.announceForAccessibility(options.message);
    timer.current = setTimeout(() => setCurrent(null), VISIBLE_MS);
  }, []);

  useEffect(() => clearTimer, []);

  async function runAction(onAction: NonNullable<SnackbarOptions["onAction"]>) {
    hide();
    try {
      await onAction();
    } catch (e) {
      console.error("Snackbar action failed", e);
      Alert.alert("That didn't work", "Something went wrong. Please try again.");
    }
  }

  const value = useMemo(() => ({ show, hide }), [show, hide]);
  const onAction = current?.onAction;

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-5"
          style={{ bottom: insets.bottom + TAB_BAR_CLEARANCE }}
        >
          <Animated.View
            key={current.key}
            entering={isReducedMotion ? undefined : FadeInDown.duration(200)}
            exiting={isReducedMotion ? undefined : FadeOutDown.duration(150)}
            className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface pl-4 pr-2 min-h-[52px]"
            accessibilityLiveRegion="polite"
          >
            <AppText variant="body-medium" className="flex-1 text-[14px] py-3" numberOfLines={2}>
              {current.message}
            </AppText>
            {current.actionLabel && onAction ? (
              <TouchableOpacity
                onPress={() => runAction(onAction)}
                className="min-h-[44px] justify-center px-3"
                accessibilityRole="button"
                accessibilityLabel={current.actionLabel}
              >
                <AppText variant="body-bold" className="text-[14px] text-secondary">
                  {current.actionLabel}
                </AppText>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error("useSnackbar must be used within SnackbarProvider");
  }
  return ctx;
}
