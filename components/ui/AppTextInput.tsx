import React, { forwardRef } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { BottomSheetTextInput, useBottomSheetInternal } from "@gorhom/bottom-sheet";
import { colors } from "@/constants/theme";
import { formatAmount, sanitizeAmount } from "@/utils/amountInput";

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  isAmount?: boolean;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
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
          ref={(node: TextInput | null | undefined) => {
            if (typeof ref === "function") {
              ref(node ?? null);
            } else if (ref) {
              ref.current = node ?? null;
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
          value={isAmount && value != null ? formatAmount(value) : value}
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
