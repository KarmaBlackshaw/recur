import { Alert } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";

// Asks before back (header, gesture or hardware) throws away a dirty form. Call `allowLeave()` right before
// navigating away on purpose, e.g. after a save or delete, so that exit isn't questioned.
export function useDiscardGuard(isDirty: boolean) {
  const disablePrevention = usePreventRemove(isDirty, ({ repeat }) => {
    Alert.alert("Discard changes?", "What you entered here won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: repeat },
    ]);
  });

  return { allowLeave: disablePrevention };
}
