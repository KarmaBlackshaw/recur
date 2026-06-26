---
name: tabbed-navigation-feature
description: 3-tab navigation (Home / Expenses / Recurring) with custom floating tab bar — architecture, decisions, gotchas
metadata:
  type: project
  date: 2026-06-22
---

# Tabbed Navigation Feature

Restructured the single-screen app into 3 tabs behind an expo-router `(tabs)` group with a custom themed floating tab bar + inline context-aware FAB.

## Architecture
- `app/(tabs)/_layout.tsx` — `<Tabs tabBar={FloatingTabBar}>`; screens `index`/`expenses`/`recurring`. Root `app/_layout.tsx` Stack unchanged → modal routes (`expense/add`, `settings`) stay at Stack level and cover the tab bar.
- `components/FloatingTabBar.tsx` — floating pill `[Home|Expenses|Recurring]` + separate circular FAB. FAB action is context-aware via route name: Home/Expenses → `/expense/add?type=regular`, Recurring → `?type=recurring`.
- `app/(tabs)/index.tsx` = **Home** — slim dashboard (greeting + settings gear + `KpiRow` totals across ALL expenses). Below KPIs: a `SectionList` of the actual upcoming items — **Overdue** (red, top) + **Upcoming — Next 7 Days**, recurring-only, reusing `ExpenseCard` (swipe/mark-paid/tap-edit). KPI row sits in `ListHeaderComponent`; "All clear" card is the `ListEmptyComponent`. (Superseded the old `→ /recurring` link card on 2026-06-26 — home now shows the list inline, not a redirect.)
- `app/(tabs)/recurring.tsx` = old `app/index.tsx` ported, greeting/settings removed, filtered to recurring-only, `KpiRow recurringOnly`. Old `app/index.tsx` deleted.
- `app/(tabs)/expenses.tsx` = paid log with own `MonthNavigator`; lists paid recurring (per month) + paid one-offs (anchored to `createdAt` month), sorted by `dueDay`, with a paid-total header.

## Key Decisions
- **Type split uses the existing `recurrence` field** (`one-off` = regular, else recurring). Did NOT implement the separate `isRecurring` spec (`2026-05-31`) — deferred/YAGNI.
- **One-off expenses auto-pay on insert:** `db/expenses.ts` `insert` forces `status='paid'` when `recurrence==='one-off'`. `insertWithId` (backup restore) left untouched so backups round-trip verbatim.
- `KpiRow` gained an additive optional `recurringOnly?: boolean` prop (filters out one-offs).
- `app/expense/add.tsx` reads a `type` URL param to set the default recurrence — only when NOT editing.
- Tab bar built custom (not native tabs) to match the dark theme; FAB sits inline beside the pill.

## Gotchas
- `@react-navigation/bottom-tabs` is **not installed** (only exists nested inside expo-router). `import type { BottomTabBarProps }` fails TS2307 → `FloatingTabBar` props are typed `any` (intentional, plan-approved). Don't "fix" by adding the dependency.
- **Baseline pre-existing tsc errors** (unrelated to features; ignore as noise): `app/_layout.tsx` global.css side-effect import (TS2882) + `components/ui/DraggableList.tsx` reanimated `SharedValue` (TS2694 ×4). A clean run = exactly these 5.
- No test runner / no lint script in repo → `npx tsc --noEmit` is the authoritative gate.
- `getDueDate(dueDay)` always uses the current month (latent imprecision for non-current months) — pre-existing, ported verbatim; out of scope.

## Process notes
- Spec: `docs/superpowers/specs/2026-06-22-tabbed-navigation-expenses-recurring-design.md`. Plan: `docs/superpowers/plans/2026-06-22-tabbed-navigation.md`.
- Executed subagent-driven in 2 parallel waves (Tasks 1–6, then Task 7), disjoint file partition. No commits (user commits manually). Final QA: ready to merge.
- **Remaining:** runtime verification in-app (`npm run android`) not yet done.
