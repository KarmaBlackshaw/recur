import React, { type ReactNode } from "react";
import { TouchableOpacity } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

interface Props {
  onDelete?: () => void;
  renderLeftActions?: (progress: SharedValue<number>, translation: SharedValue<number>, methods: SwipeableMethods) => ReactNode;
  children: ReactNode;
}

export function SwipeDeleteRow({ onDelete, renderLeftActions, children }: Props) {
  if (!onDelete && !renderLeftActions) {
    return <>{children}</>;
  }

  function renderRightActions(_progress: SharedValue<number>, _translation: SharedValue<number>, methods: SwipeableMethods) {
    function handleDelete() {
      methods.close();
      onDelete?.();
    }

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
      renderLeftActions={renderLeftActions}
      renderRightActions={onDelete ? renderRightActions : undefined}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
