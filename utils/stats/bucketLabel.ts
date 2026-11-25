import dayjs from "dayjs";
import type { Period } from "@/types";
import type { TFlowBucket } from "@/utils/stats/bucketFlows";

export function bucketLabel({ start }: Pick<TFlowBucket, "start">, period: Period): string {
  return dayjs(start).format(period === "month" ? "ddd, MMM D" : "MMMM");
}
