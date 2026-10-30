import { Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { getPreference, setPreference } from "@/db/preferences";
import { PREF_NOTIFICATIONS_ENABLED, PREF_NOTIFICATIONS_PERMISSION_ASKED } from "@/constants/preferences";
import { requestPermissions } from "@/utils/notifications";

// Asks for notification permission once, right after the first recurring bill is saved: the moment a reminder
// means something. Later bills, and anyone who already answered, skip straight past.
export async function maybeAskForReminders(billName: string): Promise<void> {
  if ((await getPreference(PREF_NOTIFICATIONS_PERMISSION_ASKED)) !== null) {
    return;
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "undetermined") {
    await setPreference(PREF_NOTIFICATIONS_PERMISSION_ASKED, "true");
    return;
  }
  Alert.alert("Get reminders?", `Recur can remind you the day before ${billName} is due.`, [
    {
      text: "Not now",
      style: "cancel",
      onPress: async () => {
        await setPreference(PREF_NOTIFICATIONS_ENABLED, "false");
        await setPreference(PREF_NOTIFICATIONS_PERMISSION_ASKED, "true");
      },
    },
    {
      text: "Turn on",
      onPress: async () => {
        const granted = await requestPermissions();
        if (!granted) {
          await setPreference(PREF_NOTIFICATIONS_ENABLED, "false");
        }
        await setPreference(PREF_NOTIFICATIONS_PERMISSION_ASKED, "true");
      },
    },
  ]);
}
