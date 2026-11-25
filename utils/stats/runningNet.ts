import type { TFlowBucket } from "@/utils/stats/bucketFlows";
import { round } from "@/utils/round";

export interface TNetPoint extends TFlowBucket {
  net: number;
}

// Income, expenses and net are running totals from the first bucket, stopping at the bucket `today` falls in.
export function runningNet(buckets: readonly TFlowBucket[], today: Date): TNetPoint[] {
  let income = 0;
  let expenses = 0;
  return buckets
    .filter(({ start }) => start.getTime() <= today.getTime())
    .map(({ key, start, ...flow }) => {
      income = round(income + flow.income, 2);
      expenses = round(expenses + flow.expenses, 2);
      return { key, start, income, expenses, net: round(income - expenses, 2) };
    });
}
