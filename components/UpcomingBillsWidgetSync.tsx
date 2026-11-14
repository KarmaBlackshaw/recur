import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { setUpcomingBillsSnapshot } from "@/modules/upcoming-bills-widget";
import { upcomingBillsJson } from "@/utils/widget/upcomingBillsJson";
import { useDueBills } from "@/utils/useDueBills";

// Keeps the "Upcoming bills" home-screen widget in step with the app's data. Renders nothing.
export function UpcomingBillsWidgetSync() {
  const { loading, getBillProgress } = useExpenses();
  const { accounts, isLoading: isAccountsLoading } = useAccounts();
  const { overdue, upcoming } = useDueBills();
  const lastPublished = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || loading || isAccountsLoading) {
      return;
    }
    const json = upcomingBillsJson({ overdue, upcoming, getBillProgress, accounts });
    if (json === lastPublished.current) {
      return;
    }
    const publish = async () => {
      try {
        await setUpcomingBillsSnapshot(json);
        lastPublished.current = json;
      } catch (error) {
        console.error("Upcoming bills widget update failed", error);
      }
    };
    void publish();
  }, [loading, isAccountsLoading, accounts, overdue, upcoming, getBillProgress]);

  return null;
}
