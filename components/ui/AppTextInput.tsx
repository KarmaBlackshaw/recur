import React, { forwardRef } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { AppText } from "./AppText";

interface AppTextInputProps extends TextInputProps {
  label?: string;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput({ label, multiline, className = "", ...props }, ref) {
    return (
      <View>
        {label && (
          <AppText variant="label" className="mb-1.5 mt-1">
            {label}
          </AppText>
        )}
        <TextInput
          ref={ref}
          className={`bg-surface border border-border rounded-[10px] px-4 py-4 text-white font-quicksand text-[15px] mb-1 ${multiline ? "h-[72px]" : "h-[52px]"} ${className}`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline={multiline}
          textAlignVertical={multiline ? "top" : undefined}
          {...props}
        />
      </View>
    );
  }
);
