// Must match HOME_LINK and URL_PREFIX in modules/upcoming-bills-widget/android/.../UpcomingBillsWidgetContract.kt and
// the app.json "scheme"; scripts/upcoming-bills-widget-check.mjs pins the contract.
export const WIDGET_URL_PREFIX = "recur://widget/";

export const WIDGET_HOME_LINK = `${WIDGET_URL_PREFIX}home`;

// month is 0-based, as everywhere in the app.
export function billWidgetLink(expenseId: string, year: number, month: number): string {
  return `${WIDGET_URL_PREFIX}bill/${encodeURIComponent(expenseId)}?year=${year}&month=${month}`;
}

export function cardWidgetLink(accountId: string): string {
  return `${WIDGET_URL_PREFIX}card/${encodeURIComponent(accountId)}`;
}

function queryNumber(query: string, name: string): number | null {
  const match = query.match(new RegExp(`(?:^|&)${name}=(\\d+)(?:&|$)`));
  return match ? Number(match[1]) : null;
}

// The in-app route a widget link opens, or null when the link isn't one the widget emits.
export function widgetLinkHref(link: string): string | null {
  if (!link.startsWith(WIDGET_URL_PREFIX)) {
    return null;
  }
  const [location, query = ""] = link.slice(WIDGET_URL_PREFIX.length).split("#")[0].split("?");
  const [target, id, ...extra] = location.replace(/\/+$/, "").split("/");
  if (extra.length > 0) {
    return null;
  }
  if (target === "home" && id === undefined) {
    return "/";
  }
  if (id === undefined || id === "") {
    return null;
  }
  if (target === "card") {
    return `/account/${id}`;
  }
  const year = queryNumber(query, "year");
  const month = queryNumber(query, "month");
  if (target === "bill" && year !== null && month !== null) {
    return `/expense/${id}?year=${year}&month=${month}`;
  }
  return null;
}
