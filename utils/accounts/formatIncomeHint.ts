import { formatAmount } from "@/utils/formatAmount";

export function formatIncomeHint(toName: string, amount: string, income: number) {
  const transferred = parseFloat(amount);
  return transferred > 0 && income > 0 ? `${toName} receives ${formatAmount(transferred + income)} in total` : null;
}
