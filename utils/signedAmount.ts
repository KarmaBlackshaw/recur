import { formatAmount } from "@/utils/dateHelpers";

export function signedAmount(amount: number): string {
  return `${amount < 0 ? "−" : ""}${formatAmount(Math.abs(amount))}`;
}
