import dayjs from "dayjs";
import groupBy from "lodash/groupBy";
import sumBy from "lodash/sumBy";

export function groupEntriesByDay<T extends { effDate: Date; amount: number }>(entries: T[]) {
  const groups = groupBy(entries, (it) => dayjs(it.effDate).format("YYYY-MM-DD"));
  return Object.entries(groups).map(([key, data]) => ({
    key,
    date: data[0].effDate,
    total: sumBy(data, "amount"),
    data,
  }));
}
