import React, { useRef } from "react";
import { Alert, Linking, Platform, Switch, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useAppLock } from "@/context/AppLockContext";
import { LockAfterSheet, type LockAfterSheetRef } from "@/components/LockAfterSheet";
import { lockAfterLabel } from "@/utils/appLock/lockAfterLabel";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { colors } from "@/constants/theme";

// Android has no app-switcher blur: hiding the screen there marks the window secure, which blocks screenshots too.
const APP_LOCK_CAPTION =
  Platform.OS === "android"
    ? "Asks for your fingerprint, face or PIN. Hides Recur in recent apps and blocks screenshots."
    : "Asks for your Face ID, Touch ID or passcode. Hides Recur in the app switcher.";

async function openSecuritySettings() {
  try {
    await Linking.sendIntent("android.settings.SECURITY_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
}

function alertNoScreenLock() {
  Alert.alert(
    "Set a screen lock first",
    "Recur uses your phone's screen lock. Add a fingerprint, face or PIN in your phone's Settings, then turn App lock on.",
    Platform.OS === "android"
      ? [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: openSecuritySettings }]
      : [{ text: "OK" }]
  );
}

export function AppLockSettings() {
  const { isEnabled, lockAfterMinutes, enable, disable, changeLockAfter } = useAppLock();
  const lockAfterSheetRef = useRef<LockAfterSheetRef>(null);
  const lockAfterText = lockAfterLabel(lockAfterMinutes);

  async function handleToggle(isOn: boolean) {
    try {
      if (!isOn) {
        await disable();
        return;
      }
      if ((await enable()) === "no-screen-lock") {
        alertNoScreenLock();
      }
    } catch (e) {
      console.error("Changing App lock failed", e);
    }
  }

  return (
    <>
      <AppLabel className="pl-1">
        Security
      </AppLabel>
      <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
        <View className="flex-row items-center px-5 py-4">
          <View className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary">
            <Feather name="lock" size={15} color="#FFFFFF" />
          </View>
          <View className="flex-1 mr-3">
            <AppText variant="body-medium" className="text-white text-sm">
              App lock
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {APP_LOCK_CAPTION}
            </AppText>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: "rgba(255,255,255,0.15)", true: colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityLabel="App lock"
          />
        </View>
        <View className="h-px bg-white/[0.07]" />

        <TouchableOpacity
          className={`flex-row items-center px-5 py-4 ${isEnabled ? "" : "opacity-40"}`}
          onPress={() => lockAfterSheetRef.current?.present()}
          disabled={!isEnabled}
          accessibilityRole="button"
          accessibilityLabel={`Lock after, ${lockAfterText}`}
          accessibilityHint={isEnabled ? undefined : "Turn on App lock to change it"}
          accessibilityState={{ disabled: !isEnabled }}
        >
          <View className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-primary">
            <Feather name="watch" size={15} color="#FFFFFF" />
          </View>
          <AppText variant="body-medium" className="flex-1 text-white text-sm">
            Lock after
          </AppText>
          <AppText variant="caption" className="text-textMuted mr-2">
            {lockAfterText}
          </AppText>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
        </TouchableOpacity>
      </View>

      <LockAfterSheet ref={lockAfterSheetRef} value={lockAfterMinutes} onChange={changeLockAfter} />
    </>
  );
}
