import { sumBy } from "@/utils/collections";
import { round } from "@/utils/round";
import type { ActivityEntry, DayTotal } from "@/components/DayGroupedExpenseList";

export function dayTotalOf(data: ActivityEntry[], dayTotal: DayTotal): number | undefined {
  if (dayTotal === "none") {
    return undefined;
  }
  if (dayTotal === "sum") {
    return sumBy(data, "amount");
  }
  const flows = data.map(dayTotal);
  return flows.some((flow) => flow !== 0) ? round(sumBy(flows, (flow) => flow), 2) : undefined;
}
