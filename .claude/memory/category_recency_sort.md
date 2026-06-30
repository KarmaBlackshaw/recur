---
name: category-recency-sort
description: Categories sorted by most-recently-used instead of manual drag order; last_used_at column bumped on every expense save; settings reorder removed
metadata:
  type: project
---

# Category Recency Sort

Replaced manual category ordering with **recently-used** sort everywhere (picker + settings).

## What changed
- **Migration** `migrated_category_last_used_v1` (db/schema.ts): `ALTER TABLE categories ADD COLUMN last_used_at TEXT` (NULL = never used), backfilled from existing history: `last_used_at = MAX(createdAt) of expenses with that category`.
- **db/categories.ts**: both `getAll`/`getAllWithIds` now order by shared `RECENCY_ORDER = "ORDER BY last_used_at IS NULL ASC, last_used_at DESC, sort_order ASC"` — used first (most recent → oldest), never-used last with `sort_order` as stable tiebreak (preserves preset order). New `touchCategory(name, at?)` bumps recency. **`updateOrder` deleted** (was the drag-reorder writer).
- **db/expenses.ts**: `insert`/`insertWithId`/`update` each call `touchCategory(e.category, ...)` after the write → covers both ExpenseContext paths (insert uses `createdAt`, insertWithId uses `e.createdAt`, update uses now). No circular import: categories.ts doesn't import expenses.ts.
- **app/settings/category/index.tsx**: dropped `DraggableList` for a plain `FlatList`; removed reorder handle + `handleReorder`; header hint "Sorted by most recently used". Delete now just filters state (no order rewrite).

## Key facts / gotchas
- `sort_order` column kept (vestigial) purely as the tiebreak for never-used categories — preset slug order. Don't remove it.
- `components/ui/DraggableList.tsx` is now **orphaned** (no callers) — left in place as a generic primitive; its 4 baseline `SharedValue TS2694` tsc errors carry a node_modules path so `grep -v node_modules` hides them.
- tsc baseline after change = 1 visible error (global.css TS2882). No new errors.
- Picker re-fetches via `getAll()` on every `present()`, so recency reflects immediately after a save.
