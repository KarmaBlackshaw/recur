export interface TCategoryLine {
  category: string;
  amount: number;
}

export interface TCategorySpend {
  category: string;
  amount: number;
  count: number;
  share: number;
}

// Biggest first. Ties break by name so the order, and the chart hues derived from it, stay stable.
export function categoryBreakdown(lines: TCategoryLine[]): TCategorySpend[] {
  const totals = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const { category, amount } of lines) {
    if (amount <= 0) {
      continue;
    }
    const current = totals.get(category) ?? { amount: 0, count: 0 };
    totals.set(category, { amount: current.amount + amount, count: current.count + 1 });
    total += amount;
  }
  return [...totals]
    .map(([category, { amount, count }]) => ({ category, amount, count, share: amount / total }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}
