import { useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";

// Asks before back (header, gesture or hardware) throws away a dirty form. Call `allowLeave()` right before
// navigating away on purpose, e.g. after a save or delete, so that exit isn't questioned.
export function useDiscardGuard(isDirty: boolean) {
  const navigation = useNavigation();
  const isLeaving = useRef(false);

  usePreventRemove(isDirty, ({ data }) => {
    if (isLeaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert("Discard changes?", "What you entered here won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  return {
    allowLeave: () => {
      isLeaving.current = true;
    },
  };
}
