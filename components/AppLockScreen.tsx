import React, { useEffect } from "react";
import { BackHandler, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useAppLock } from "@/context/AppLockContext";
import { AppText } from "@/components/ui/AppText";
import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/constants/theme";

export function AppLockScreen() {
  const { status, isAuthenticating, unlock } = useAppLock();
  const isUnlocked = status === "unlocked";

  // Back would otherwise pop the screen hidden underneath.
  useEffect(() => {
    if (isUnlocked) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, [isUnlocked]);

  if (isUnlocked) {
    return null;
  }

  return (
    <View className="absolute inset-0 bg-background items-center justify-center px-8" accessibilityViewIsModal>
      <View className="w-16 h-16 rounded-full bg-primary/15 items-center justify-center mb-5">
        <Feather name="lock" size={26} color={colors.secondary} />
      </View>
      {status === "locked" && (
        <>
          <AppText variant="title" className="mb-2" accessibilityRole="header">
            Recur is locked
          </AppText>
          <AppText variant="body" className="text-textSecondary text-sm text-center mb-8">
            Unlock with your fingerprint, face or PIN.
          </AppText>
          <AppButton label="Unlock" className="self-stretch" loading={isAuthenticating} onPress={unlock} />
        </>
      )}
    </View>
  );
}
