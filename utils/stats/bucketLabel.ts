import dayjs from "dayjs";
import type { BarBucket } from "@/types";
import type { TFlowBucket } from "@/utils/stats/bucketFlows";

export function bucketLabel({ start, end }: TFlowBucket, unit: BarBucket): string {
  const first = dayjs(start);
  if (unit === "day") {
    return first.format("ddd, MMM D");
  }
  if (unit === "month") {
    return first.format("MMMM");
  }
  const last = dayjs(end);
  if (first.isSame(last, "day")) {
    return first.format("MMM D");
  }
  return `${first.format("MMM D")} – ${last.format(first.isSame(last, "month") ? "D" : "MMM D")}`;
}
