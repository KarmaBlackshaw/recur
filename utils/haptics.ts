import * as Haptics from "expo-haptics";

// Fire-and-forget: a missed haptic is never worth blocking or failing the action it accompanies.
export function selectionHaptic(): void {
  void Haptics.selectionAsync();
}

export function successHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
