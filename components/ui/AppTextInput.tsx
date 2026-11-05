import React, { forwardRef } from "react";
import { TextInput, TextInputProps, View, type TextInputInstance } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { BottomSheetTextInput, useBottomSheetInternal } from "@gorhom/bottom-sheet";
import type { TextInput as GestureTextInput } from "react-native-gesture-handler";
import { colors } from "@/constants/theme";
import { formatAmountInput, sanitizeAmount } from "@/utils/amountInput";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  isAmount?: boolean;
}

export const AppTextInput = forwardRef<TextInputInstance, AppTextInputProps>(
  function AppTextInput({ label, error, multiline, isAmount, value, onChangeText, className = "", ...props }, ref) {
    // gorhom only lifts the sheet above the keyboard when the focused input is a BottomSheetTextInput
    const Input = useBottomSheetInternal(true) ? BottomSheetTextInput : TextInput;
    return (
      <View className={label ? undefined : "mt-3"}>
        {label && (
          <AppLabel>
            {label}
          </AppLabel>
        )}
        <Input
          // gorhom 5.2.14 types BottomSheetTextInput's ref as RNGH 3's TextInput component type; at runtime it's the instance.
          ref={(node: TextInputInstance | GestureTextInput | null | undefined) => {
            const instance = typeof node === "function" ? null : (node ?? null);
            if (typeof ref === "function") {
              ref(instance);
            } else if (ref) {
              ref.current = instance;
            }
          }}
          className={`bg-surface border rounded-xl px-4 py-4 text-white font-quicksand text-[15px] mb-1 ${error ? "border-overdue" : "border-border"} ${multiline ? "min-h-[96px]" : "min-h-[52px]"} ${className}`}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : undefined}
          accessibilityLabel={label}
          accessibilityHint={error}
          keyboardType={isAmount ? "decimal-pad" : undefined}
          {...props}
          value={isAmount && value != null ? formatAmountInput(value) : value}
          onChangeText={isAmount ? (text) => onChangeText?.(sanitizeAmount(text)) : onChangeText}
        />
        {error && (
          <View className="flex-row items-center gap-1.5 mb-1" accessibilityLiveRegion="polite">
            <Feather name="alert-circle" size={12} color={colors.overdue} />
            <AppText variant="meta" className="text-overdue">
              {error}
            </AppText>
          </View>
        )}
      </View>
    );
  }
);
