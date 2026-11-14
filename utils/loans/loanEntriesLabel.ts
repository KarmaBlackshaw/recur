import { countLabel } from "@/utils/countLabel";

export function loanEntriesLabel({ paymentCount, incomeCount }: { paymentCount: number; incomeCount: number }) {
  const entries = [
    { count: paymentCount, label: countLabel(paymentCount, "payment", "payments") },
    { count: incomeCount, label: countLabel(incomeCount, "income entry", "income entries") },
  ].filter(({ count }) => count > 0);

  if (entries.length === 0) {
    return null;
  }

  return entries.map(({ label }) => label).join(" and ");
}
