import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { MARK_PAID_ACTION } from "@/utils/notifications";

function numberOf(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

// Opens what a tapped reminder is about: the bill (its Pay sheet for the "Mark paid" action), or Home when one
// reminder covers several bills. Renders nothing.
export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  // A tap that cold-starts the app arrives before the navigator is ready; routing waits for it.
  const isNavigationReady = useRootNavigationState()?.key != null;

  useEffect(() => {
    if (!response || !isNavigationReady) {
      return;
    }
    async function route(handled: Notifications.NotificationResponse) {
      // Cleared first, so a relaunch doesn't replay an old tap.
      await Notifications.clearLastNotificationResponseAsync();
      const data = handled.notification.request.content.data ?? {};
      const expenseId = typeof data.expenseId === "string" ? data.expenseId : null;
      const year = numberOf(data.year);
      const month = numberOf(data.month);
      if (expenseId == null || year == null || month == null) {
        router.navigate("/");
        return;
      }
      router.push({
        pathname: "/expense/[id]",
        params: {
          id: expenseId,
          year,
          month,
          ...(handled.actionIdentifier === MARK_PAID_ACTION ? { action: "pay" } : {}),
        },
      });
    }
    route(response);
  }, [response, isNavigationReady]);

  return null;
}
