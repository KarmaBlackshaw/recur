import { TRANSFER_CATEGORY } from "@/constants/categories";
import { formatAmount } from "@/utils/formatAmount";

export function formatIncomeSummary(income: number) {
  if (isNaN(income)) {
    return "Invalid amount";
  }
  return income > 0 ? `${formatAmount(income)} · ${TRANSFER_CATEGORY}` : "None";
}
