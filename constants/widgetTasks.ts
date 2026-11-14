// The headless JS task the Upcoming bills widget's midnight job runs (registered in index.ts).
// Must match REFRESH_TASK in modules/upcoming-bills-widget/android/.../UpcomingBillsWidgetContract.kt;
// scripts/upcoming-bills-widget-check.mjs pins it.
export const UPCOMING_BILLS_REFRESH_TASK = "RecurUpcomingBillsRefresh";
