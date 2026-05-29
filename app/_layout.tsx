import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ExpenseProvider } from "../context/ExpenseContext";
import { colors } from "../constants/theme";
import { requestPermissions } from "../utils/notifications";
import { getPreference, setPreference } from "../db/preferences";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Oswald_Regular: require("../assets/fonts/oswald/Oswald-Regular.ttf"),
    Oswald_Medium: require("../assets/fonts/oswald/Oswald-Medium.ttf"),
    Oswald_SemiBold: require("../assets/fonts/oswald/Oswald-SemiBold.ttf"),
    Oswald_Bold: require("../assets/fonts/oswald/Oswald-Bold.ttf"),
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    (async () => {
      const asked = await getPreference('notificationsPermissionAsked');
      if (asked !== null) return;
      const granted = await requestPermissions();
      if (!granted) await setPreference('notificationsEnabled', 'false');
      await setPreference('notificationsPermissionAsked', 'true');
    })();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ExpenseProvider>
          <BottomSheetModalProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            />
          </BottomSheetModalProvider>
        </ExpenseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
