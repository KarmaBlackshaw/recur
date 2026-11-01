import type { FeatherIconName } from "@/types";

export interface TCategoryLine {
  category: string;
  icon: FeatherIconName;
  amount: number;
}

export interface TCategorySpend {
  category: string;
  icon: FeatherIconName;
  amount: number;
  count: number;
  share: number;
}

// Biggest first. Ties break by name so the order, and the chart hues derived from it, stay stable.
export function categoryBreakdown(lines: TCategoryLine[]): TCategorySpend[] {
  const totals = new Map<string, { icon: FeatherIconName; amount: number; count: number }>();
  let total = 0;
  for (const { category, icon, amount } of lines) {
    if (amount <= 0) {
      continue;
    }
    const current = totals.get(category) ?? { icon, amount: 0, count: 0 };
    totals.set(category, { icon: current.icon, amount: current.amount + amount, count: current.count + 1 });
    total += amount;
  }
  return [...totals]
    .map(([category, { icon, amount, count }]) => ({ category, icon, amount, count, share: amount / total }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}
