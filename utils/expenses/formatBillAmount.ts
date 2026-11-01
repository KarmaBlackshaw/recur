import { formatAmount } from "@/utils/formatAmount";

export function formatBillAmount(amount: number | null | undefined) {
  return amount != null ? formatAmount(amount) : "TBD";
}
