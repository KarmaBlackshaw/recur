import { useEffect, useState } from "react";
import { AppState } from "react-native";
import dayjs from "dayjs";

const CHECK_INTERVAL_MS = 60_000;

// Start of today. Refreshes when the app returns to the foreground or the date rolls over while it's open,
// so anything split by "today" (Overdue vs Upcoming, the greeting) doesn't stay on yesterday.
export function useToday(): Date {
  const [today, setToday] = useState(() => dayjs().startOf("day").toDate());

  useEffect(() => {
    const refresh = () => {
      setToday((prev) => (dayjs().isSame(prev, "day") ? prev : dayjs().startOf("day").toDate()));
    };
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        refresh();
      }
    });
    const timer = setInterval(refresh, CHECK_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  return today;
}
