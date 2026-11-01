import { formatAmount } from "@/utils/dateHelpers";

export function formatBillAmount(amount: number | null | undefined) {
  return amount != null ? formatAmount(amount) : "TBD";
}
