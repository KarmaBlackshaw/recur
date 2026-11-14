import "expo-router/entry";
import { AppRegistry } from "react-native";
import { UPCOMING_BILLS_REFRESH_TASK } from "@/constants/widgetTasks";
import { refreshUpcomingBillsWidget } from "@/utils/widget/refreshUpcomingBillsWidget";

// Run by the Upcoming bills widget's midnight job (UpcomingBillsRefreshJobService), with no screen mounted.
AppRegistry.registerHeadlessTask(UPCOMING_BILLS_REFRESH_TASK, () => refreshUpcomingBillsWidget);
