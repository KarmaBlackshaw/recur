import React, { forwardRef } from "react";
import { KeyboardAvoidingView, ScrollView, type ScrollViewProps } from "react-native";

// Android runs edge-to-edge, so the window no longer resizes for the keyboard; padding keeps the focused field reachable.
export const AppFormScrollView = forwardRef<ScrollView, ScrollViewProps>(function AppFormScrollView(props, ref) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView ref={ref} {...props} />
    </KeyboardAvoidingView>
  );
});
