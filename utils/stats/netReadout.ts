import dayjs from "dayjs";
import type { Period } from "@/types";
import { formatAmount } from "@/utils/formatAmount";
import { signedAmount } from "@/utils/signedAmount";
import type { TNetPoint } from "@/utils/stats/runningNet";

export function netReadout({ start, net }: TNetPoint, period: Period): string {
  const by = dayjs(start).format(period === "month" ? "MMM D" : "MMMM");
  if (net > 0) {
    return `By ${by} · ahead ${formatAmount(net)}`;
  }
  if (net < 0) {
    return `By ${by} · behind ${formatAmount(-net)}`;
  }
  return `By ${by} · even`;
}

export function signedNet(net: number): string {
  return `${net > 0 ? "+" : ""}${signedAmount(net)}`;
}
