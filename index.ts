import "expo-router/entry";
import { AppRegistry, Platform } from "react-native";
import { UPCOMING_BILLS_REFRESH_TASK } from "@/constants/widgetTasks";
import { refreshUpcomingBillsWidget } from "@/utils/widget/refreshUpcomingBillsWidget";

// Run by the Upcoming bills widget's midnight job (UpcomingBillsRefreshJobService), with no screen mounted.
// Headless JS is Android-only: React Native Web's AppRegistry has no registerHeadlessTask.
if (Platform.OS === "android") {
  AppRegistry.registerHeadlessTask(UPCOMING_BILLS_REFRESH_TASK, () => refreshUpcomingBillsWidget);
}
