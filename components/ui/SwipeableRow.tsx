import React, { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Feather } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { selectionHaptic } from "@/utils/haptics";
import type { FeatherIconName } from "@/types";

// Dragging the row 64 of the action's 80dp counts as a full swipe.
const FULL_SWIPE_THRESHOLD = 64;
const HINT_DELAY_MS = 700;
const HINT_HOLD_MS = 900;

export interface SwipeAction {
  label: string;
  icon: FeatherIconName;
  tone: "positive" | "negative";
  onPress: () => void;
}

const TONE = {
  positive: { box: "bg-paid/15", text: "text-paid", glyph: colors.paid },
  negative: { box: "bg-overdue/15", text: "text-overdue", glyph: colors.overdue },
} as const;

interface Props {
  children: React.ReactNode;
  // Revealed by swiping right. A full swipe fires it straight away.
  leftAction?: SwipeAction;
  // Revealed by swiping left. Needs a tap, so a stray swipe can't trigger it.
  rightAction?: SwipeAction;
  // Briefly reveals the left action once, to teach the gesture.
  isHintShown?: boolean;
}

// Only one row stays swiped open at a time across every list.
let openRow: SwipeableMethods | null = null;

export function SwipeableRow({ children, leftAction, rightAction, isHintShown = false }: Props) {
  const ref = useRef<SwipeableMethods>(null);
  const isPeeking = useRef(false);

  useEffect(() => {
    if (!isHintShown || !leftAction) {
      return;
    }
    const open = setTimeout(() => {
      isPeeking.current = true;
      ref.current?.openLeft();
    }, HINT_DELAY_MS);
    const close = setTimeout(() => ref.current?.close(), HINT_DELAY_MS + HINT_HOLD_MS);
    return () => {
      clearTimeout(open);
      clearTimeout(close);
    };
  }, [isHintShown]);

  useEffect(
    () => () => {
      if (openRow === ref.current) {
        openRow = null;
      }
    },
    []
  );

  function handleWillOpen() {
    if (openRow && openRow !== ref.current) {
      openRow.close();
    }
    openRow = ref.current;
    if (!isPeeking.current) {
      selectionHaptic();
    }
  }

  function handleOpen(direction: SwipeDirection) {
    if (direction !== SwipeDirection.RIGHT || !leftAction || isPeeking.current) {
      return;
    }
    ref.current?.close();
    leftAction.onPress();
  }

  function handleClose() {
    isPeeking.current = false;
    if (openRow === ref.current) {
      openRow = null;
    }
  }

  function runRightAction() {
    ref.current?.close();
    rightAction?.onPress();
  }

  // RNGH Pressable, not TouchableOpacity: the swipeable's full-width right-actions layer sits on top
  // and swallows RN touches on the left side; RNGH's own hit-testing passes through it.
  function renderLeftActions() {
    if (!leftAction) {
      return null;
    }
    const tone = TONE[leftAction.tone];
    return (
      <Pressable
        onPress={() => handleOpen(SwipeDirection.RIGHT)}
        accessibilityRole="button"
        accessibilityLabel={leftAction.label}
      >
        <View className={`flex-1 justify-center items-center gap-1 w-20 my-1.5 ml-5 rounded-2xl ${tone.box}`}>
          <Feather name={leftAction.icon} size={20} color={tone.glyph} />
          <AppText variant="meta" className={tone.text}>{leftAction.label}</AppText>
        </View>
      </Pressable>
    );
  }

  function renderRightActions() {
    if (!rightAction) {
      return null;
    }
    const tone = TONE[rightAction.tone];
    return (
      <TouchableOpacity
        className={`justify-center items-center gap-1 w-20 my-1.5 mr-5 rounded-2xl ${tone.box}`}
        onPress={runRightAction}
        accessibilityRole="button"
        accessibilityLabel={rightAction.label}
      >
        <Feather name={rightAction.icon} size={20} color={tone.glyph} />
        <AppText variant="meta" className={tone.text}>{rightAction.label}</AppText>
      </TouchableOpacity>
    );
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      renderLeftActions={leftAction ? renderLeftActions : undefined}
      renderRightActions={rightAction ? renderRightActions : undefined}
      leftThreshold={FULL_SWIPE_THRESHOLD}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableOpen={handleOpen}
      onSwipeableClose={handleClose}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
