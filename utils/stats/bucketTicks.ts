import dayjs from "dayjs";
import type { BarBucket, Period } from "@/types";
import type { TFlowBucket } from "@/utils/stats/bucketFlows";

const DAY_TICKS = new Set([1, 8, 15, 22, 29]);

export function bucketTicks(buckets: readonly TFlowBucket[], unit: BarBucket, period: Period): (string | undefined)[] {
  return buckets.map(({ start }, index) => {
    const first = dayjs(start);
    if (unit === "day") {
      return DAY_TICKS.has(first.date()) ? String(first.date()) : undefined;
    }
    if (unit === "week" && period === "month") {
      return String(first.date());
    }
    const isNewMonth = unit === "month" || index === 0 || !first.isSame(buckets[index - 1].start, "month");
    return isNewMonth ? first.format("MMMM")[0] : undefined;
  });
}
