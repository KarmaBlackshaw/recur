import { useState } from "react";
import { Alert } from "react-native";
import { usePreventRemove } from "expo-router/react-navigation";

// Asks before back (header, gesture or hardware) throws away a dirty form. Call `allowLeave()` right before
// navigating away on purpose, e.g. after a save or delete, so that exit isn't questioned.
export function useDiscardGuard(isDirty: boolean) {
  // Leaving turns `preventRemove` off in the same handler as `disablePrevention`/`repeat`; a still-dirty form
  // would otherwise leave it true and React Navigation warns that the two are out of sync.
  const [isLeaving, setIsLeaving] = useState(false);
  const disablePrevention = usePreventRemove(isDirty && !isLeaving, ({ repeat }) => {
    Alert.alert("Discard changes?", "What you entered here won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setIsLeaving(true);
          repeat();
        },
      },
    ]);
  });

  function allowLeave() {
    setIsLeaving(true);
    disablePrevention();
  }

  return { allowLeave };
}
