---
name: home-upcoming-always-shown
description: Home "Upcoming — Next 7 Days" section always renders, with a placeholder row when empty (7-day window kept)
metadata:
  type: project
  date: 2026-06-27
---

# Home Upcoming Section Always Shown

Home (`app/(tabs)/index.tsx`) now **always** renders the "Upcoming — Next 7 Days" recurring section header, even with zero items. When empty it shows a muted surface-card placeholder ("Nothing due in the next 7 days") instead of hiding.

## Decisions (from clarifying Q&A)
- **Window unchanged** — kept the 7-day window (unpaid recurring whose due date ∈ `[today, today+7]`). User explicitly chose this over widening / all-future.
- **Always show header** with empty-state placeholder (vs hide-when-empty).

## Implementation (single file, ~15 lines)
- `Section` interface gains `emptyHint?: string`.
- Upcoming section pushed **unconditionally** (dropped the `upcoming.length > 0` guard); carries `emptyHint: "Nothing due in the next 7 days"`. Overdue/Recently-Paid still pushed only when non-empty.
- New `renderSectionFooter`: renders the placeholder row (surface card + `check-circle` + hint) when `section.data.length === 0 && section.emptyHint`. Generic via `emptyHint` so any section can opt in.
- Removed the now-dead `ListEmptyComponent` — `sections` always has ≥1 entry (the Upcoming section) once `expenses.length > 0`, so it never fired. The `expenses.length === 0` → `EmptyState` branch is untouched.

## Verification
- `npx tsc --noEmit` clean except baseline (global.css TS2882 + DraggableList TS2694 ×4 under node_modules path).
- Runtime (header + placeholder visible with no due-soon recurring; cards otherwise) NOT yet verified on device.
