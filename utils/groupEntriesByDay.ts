import dayjs from "dayjs";
import groupBy from "lodash/groupBy";
import sumBy from "lodash/sumBy";
import type { DayEntry } from "../components/DayGroupedExpenseList";

export function groupEntriesByDay(entries: DayEntry[]) {
  const groups = groupBy(entries, (it) => dayjs(it.effDate).format("YYYY-MM-DD"));
  return Object.entries(groups).map(([key, data]) => ({
    key,
    date: data[0].effDate,
    total: sumBy(data, "amount"),
    data,
  }));
}
