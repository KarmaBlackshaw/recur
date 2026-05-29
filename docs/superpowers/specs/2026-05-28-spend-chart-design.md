# Spend Chart — Design Spec

**Date:** 2026-05-28

## TL;DR

Add a category-breakdown donut chart to the home screen, between the KPI row and the expense list divider. Built with `react-native-svg` — no third-party chart library. Shows current month's paid + unpaid spend split by category. Expenses with `amount = null` are excluded with a footnote.

## Data

Derived in-memory from `currentMonthList` (already computed in `HomeScreen`). No new DB query.

```ts
type ChartSlice = {
  category: string;
  amount: number;
  color: string;
  percentage: number;
};
```

Computation:
1. Filter `currentMonthList` to expenses where `amount !== null`
2. Group by `category`, sum `amount`
3. Sort descending by amount
4. Assign colors from fixed palette (cycle if > palette length)
5. Compute `percentage = amount / total * 100`

Color palette (in order): `#6366F1`, `#818CF8`, `#34D399`, `#F87171`, `#FBBF24`, `#60A5FA`, `#A78BFA`

## Component: `components/SpendChart.tsx`

Props:
```ts
interface SpendChartProps {
  expenses: Expense[];  // currentMonthList
}
```

Internal structure:
- Computes slices from props
- Renders `<Svg>` donut (SVG arc paths) — 140px diameter, 28px stroke width (ring, not filled)
- Center label: total formatted amount
- Legend below chart: rows of `[colored dot] [category name] [amount] [percentage]`
- Hidden entirely when `expenses.length === 0`
- Shows footnote "N expense(s) with TBD amounts not shown" when any `amount === null`

### Donut math

Each slice is an SVG arc. For a given `percentage`:
- `startAngle` = sum of previous percentages × 360°
- `endAngle` = `startAngle + percentage × 360°`
- Arc path computed via `polarToCartesian` helper (standard SVG arc formula)
- 2px gap between slices (subtract from arc sweep)

No dependency on any chart library. Only `react-native-svg`.

## Placement in `app/index.tsx`

```
<KpiRow />
<SpendChart expenses={currentMonthList} />   ← insert here
<View divider />
<SectionList />
```

Hidden when `expenses.length === 0` (same gate as KpiRow).

## Package

Add `react-native-svg` (already likely present via other deps — check first). If missing: `npx expo install react-native-svg`.

## Verification

- [ ] Chart appears below KPI row with correct slices per category
- [ ] Colors assigned consistently (same category = same color across rerenders)
- [ ] Center label shows correct total
- [ ] Legend rows match chart slices
- [ ] Expenses with `amount = null` excluded; footnote shown
- [ ] Chart hidden when expense list is empty
- [ ] Single-category: full ring, no gaps
