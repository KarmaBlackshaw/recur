import React, { useEffect } from "react";
import { View } from "react-native";
import { useMount } from "@/utils/useMount";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Quicksand_400Regular } from "@expo-google-fonts/quicksand/400Regular";
import { Quicksand_500Medium } from "@expo-google-fonts/quicksand/500Medium";
import { Quicksand_600SemiBold } from "@expo-google-fonts/quicksand/600SemiBold";
import { Quicksand_700Bold } from "@expo-google-fonts/quicksand/700Bold";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { ExpenseProvider } from "@/context/ExpenseContext";
import { AccountProvider } from "@/context/AccountContext";
import { LoanProvider } from "@/context/LoanContext";
import { TransferTemplateProvider } from "@/context/TransferTemplateContext";
import { SnackbarProvider } from "@/context/SnackbarContext";
import { PayFlowProvider } from "@/context/PayFlowContext";
import { AppLockProvider, useAppLockState } from "@/context/AppLockContext";
import { NotificationRouter } from "@/components/NotificationRouter";
import { AppLockScreen } from "@/components/AppLockScreen";
import { colors } from "@/constants/theme";
import { registerNotificationCategories } from "@/utils/notifications";
import "@/global.css";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oswald_Regular: require("@/assets/fonts/oswald/Oswald-Regular.ttf"),
    Oswald_Medium: require("@/assets/fonts/oswald/Oswald-Medium.ttf"),
    Oswald_SemiBold: require("@/assets/fonts/oswald/Oswald-SemiBold.ttf"),
    Oswald_Bold: require("@/assets/fonts/oswald/Oswald-Bold.ttf"),
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  const appLock = useAppLockState();
  const isFontReady = fontsLoaded || fontError != null;
  // The splash stays until App lock is read, so a locked app never shows for a frame.
  const isReady = isFontReady && appLock.isReady;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Permission is asked after the first recurring bill is saved (utils/reminderPermission.ts), not at launch.
  useMount(async () => {
    try {
      await registerNotificationCategories();
    } catch (e) {
      console.error("Registering notification actions failed", e);
    }
  });

  if (!isReady) {
    return null;
  }
  const isHidden = appLock.status !== "unlocked";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppLockProvider value={appLock}>
          <View
            className="flex-1"
            importantForAccessibility={isHidden ? "no-hide-descendants" : "auto"}
            accessibilityElementsHidden={isHidden}
          >
            <AccountProvider>
              <LoanProvider>
                <TransferTemplateProvider>
                  <ExpenseProvider>
                    <SnackbarProvider>
                      <BottomSheetModalProvider>
                        <PayFlowProvider>
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              contentStyle: { backgroundColor: colors.background },
                            }}
                          />
                          <NotificationRouter />
                        </PayFlowProvider>
                      </BottomSheetModalProvider>
                    </SnackbarProvider>
                  </ExpenseProvider>
                </TransferTemplateProvider>
              </LoanProvider>
            </AccountProvider>
          </View>
          <AppLockScreen />
        </AppLockProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
