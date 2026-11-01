import { formatAmount } from "@/utils/formatAmount";

export function signedAmount(amount: number): string {
  return `${amount < 0 ? "−" : ""}${formatAmount(Math.abs(amount))}`;
}
