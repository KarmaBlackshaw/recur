import dayjs from "dayjs";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { BarBucket, Period } from "@/types";
import { categoryLine } from "@/utils/activity/categoryLine";

export interface TFlowBucket {
  key: string;
  start: Date;
  end: Date;
  income: number;
  expenses: number;
}

const KEY_FORMAT: Record<BarBucket, string> = { day: "YYYY-MM-DD", week: "YYYY-MM-DD", month: "YYYY-MM" };

export function bucketFlows({ entries, year, month, period, bucket }: {
  entries: readonly ActivityEntry[];
  year: number;
  month: number;
  period: Period;
  bucket: BarBucket;
}): TFlowBucket[] {
  const periodStart = dayjs(new Date(year, period === "year" ? 0 : month, 1));
  const periodEnd = periodStart.endOf(period).startOf("day");
  const buckets: TFlowBucket[] = [];
  for (let cursor = periodStart; !cursor.isAfter(periodEnd); cursor = cursor.add(1, "day")) {
    const bucketEnd = cursor.endOf(bucket).startOf("day");
    const end = bucketEnd.isAfter(periodEnd) ? periodEnd : bucketEnd;
    buckets.push({ key: cursor.format(KEY_FORMAT[bucket]), start: cursor.toDate(), end: end.toDate(), income: 0, expenses: 0 });
    cursor = end;
  }
  for (const entry of entries) {
    const day = dayjs(entry.effDate).startOf("day").valueOf();
    const target = buckets.find(({ start, end }) => start.getTime() <= day && day <= end.getTime());
    if (target) {
      target.income += categoryLine(entry, "income")?.amount ?? 0;
      target.expenses += categoryLine(entry, "expenses")?.amount ?? 0;
    }
  }
  return buckets;
}
