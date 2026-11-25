import dayjs from "dayjs";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { Period } from "@/types";
import { categoryLine } from "@/utils/activity/categoryLine";

export interface TFlowBucket {
  key: string;
  start: Date;
  income: number;
  expenses: number;
}

const UNIT = { month: "day", year: "month" } as const;
const KEY_FORMAT = { day: "YYYY-MM-DD", month: "YYYY-MM" } as const;

export function bucketFlows({ entries, year, month, period }: {
  entries: readonly ActivityEntry[];
  year: number;
  month: number;
  period: Period;
}): TFlowBucket[] {
  const unit = UNIT[period];
  const periodStart = dayjs(new Date(year, period === "year" ? 0 : month, 1));
  const count = period === "year" ? 12 : periodStart.daysInMonth();
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = periodStart.add(index, unit);
    return { key: start.format(KEY_FORMAT[unit]), start: start.toDate(), income: 0, expenses: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const entry of entries) {
    const target = byKey.get(dayjs(entry.effDate).format(KEY_FORMAT[unit]));
    if (target) {
      target.income += categoryLine(entry, "income")?.amount ?? 0;
      target.expenses += categoryLine(entry, "expenses")?.amount ?? 0;
    }
  }
  return buckets;
}
