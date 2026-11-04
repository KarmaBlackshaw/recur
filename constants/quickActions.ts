export const QUICK_ACTION_HREF = {
  expense: "/expense/add?type=regular",
  recurring: "/expense/add?type=recurring",
  income: "/income/add",
  transfer: "/transfer",
  loan: "/loan/add",
} as const;

export type QuickAction = keyof typeof QUICK_ACTION_HREF;

export const WIDGET_QUICK_ACTIONS = ["expense", "income", "transfer", "loan"] as const;

export type WidgetQuickAction = (typeof WIDGET_QUICK_ACTIONS)[number];

export function isWidgetQuickAction(value: string): value is WidgetQuickAction {
  return WIDGET_QUICK_ACTIONS.some((action) => action === value);
}

// Must match URL_PREFIX in plugins/withQuickAddWidget/android/QuickAddWidgetProvider.kt and the app.json "scheme".
export const QUICK_ADD_URL_PREFIX = "recur://quick-add/";
