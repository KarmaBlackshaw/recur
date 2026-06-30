---
name: home-day-window-selector
description: Home screen day-window selector (1/7/15 days) filtering Upcoming + Recently Paid sections
metadata:
  type: project
---

# Home Day-Window Selector

## What was built
Segmented pill on Home letting user switch the day window: **1 Day / 7 Days / 15 Days**. Filters both the **Upcoming** (next N days) and **Recently Paid** (last N days) sections. Default = 7 days (preserves prior behavior).

## Files
- **`components/DayWindowSelector.tsx`** (new) — segmented control. Exports `DAY_WINDOWS = [1,7,15] as const`, `type DayWindow`, `windowLabel(days)` → `"7 Days"` / `"1 Day"`. Active segment `bg-primary`, inactive `text-white/50`. NativeWind only (no StyleSheet). a11y `accessibilityState={{ selected }}`.
- **`app/(tabs)/index.tsx`** — `const [windowDays, setWindowDays] = useState<DayWindow>(7)`. Pill rendered in `ListHeaderComponent` directly under `<KpiRow>`.

## Key decisions / gotchas
- **Scope:** Upcoming + Recently Paid only. Overdue intentionally NOT filtered.
- Replaced hardcoded `in7 = addDays(today, 7)` with `inN = addDays(today, windowDays)`; `last7` → `lastN = addDays(today, -windowDays)`.
- Section titles are static `"Upcoming"` / `"Recently Paid"` — the pill is the window indicator, so the old `— Next N Days` / `— Last N Days` suffixes were dropped. `windowLabel(windowDays)` still used in the Upcoming empty hint: `Nothing due in the next ${...}` (`.toLowerCase()`).
- **Must add `windowDays` to the `useMemo` deps array** — otherwise sections won't recompute on selection.
- Pure in-memory filter — no DB / schema / migration change.
- Font `Quicksand_600SemiBold` confirmed loaded (verified before use).
- tsc baseline unchanged at 5 errors (global.css TS2882 + DraggableList ×4) — no new errors.
