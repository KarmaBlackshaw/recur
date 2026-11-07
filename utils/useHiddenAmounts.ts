import { useEffect } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { useBoolean, type BooleanActions } from "@/utils/useBoolean";

// Amounts on a tab start hidden, and hide again once the app leaves the foreground or another tab is picked.
// Opening a screen on top of the tab (an account's page) and coming back keeps them shown.
export function useHiddenAmounts(tabName: string): [boolean, BooleanActions] {
  const navigation = useNavigation();
  const [isHidden, actions] = useBoolean(true);
  const { setTrue: hide } = actions;

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (status) => {
      if (status !== "active") {
        hide();
      }
    });
    const removeTabListener = navigation.addListener("state", ({ data: { state } }) => {
      if (state.routes[state.index]?.name !== tabName) {
        hide();
      }
    });
    return () => {
      appStateSubscription.remove();
      removeTabListener();
    };
  }, [navigation, tabName, hide]);

  return [isHidden, actions];
}
