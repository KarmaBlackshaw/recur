import dayjs from "dayjs";
import type { Period } from "@/types";
import type { TFlowBucket } from "@/utils/stats/bucketFlows";

const DAY_TICKS = new Set([1, 8, 15, 22, 29]);

export function bucketTicks(buckets: readonly TFlowBucket[], period: Period): (string | undefined)[] {
  return buckets.map(({ start }) => {
    const first = dayjs(start);
    if (period === "month") {
      return DAY_TICKS.has(first.date()) ? String(first.date()) : undefined;
    }
    return first.format("MMMM")[0];
  });
}
