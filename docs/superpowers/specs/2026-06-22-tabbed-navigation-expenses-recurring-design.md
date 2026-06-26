# Tabbed Navigation — Home / Expenses / Recurring

**Date:** 2026-06-22
**Status:** Draft — awaiting user review

## TL;DR

Restructure the single-screen app into a 3-tab layout behind an expo-router `(tabs)` group with a **custom themed floating tab bar** and a **context-aware FAB** sitting inline to its right. **Recurring** tab becomes today's home screen (month nav + KPIs + overdue/upcoming/this-month/next-month) minus the greeting, filtered to recurring expenses only. **Expenses** tab is a paid log with its own month picker showing every paid expense for the selected month. **Home** is a new slim summary dashboard (greeting + settings + cross-cutting totals + highlights). Regular vs recurring is derived from the existing `recurrence` field (`one-off` = regular); one-off expenses are now **auto-paid on creation**.

## Decisions

| Decision | Choice |
|---|---|
| Navigation | expo-router `(tabs)` group; modal routes (`expense/add`, `settings`) stay in the parent Stack so they cover the tab bar |
| Tab bar | Custom `FloatingTabBar` component via `Tabs` `tabBar` render prop — floating pill `[ Home \| Expenses \| Recurring ]` + separate circular FAB, both themed to the dark palette |
| FAB | Context-aware. Home → `+ regular expense`; Expenses → `+ expense` (regular); Recurring → `+ recurring expense`. Icon-only `+`; only the destination/preset differs |
| Type split | Existing `recurrence` field. `recurrence === 'one-off'` = **regular**; anything else (`weekly`/`monthly`/`yearly`) = **recurring**. No new `isRecurring` column |
| Home tab | New slim dashboard. Owns the greeting (moved off Recurring) + settings gear + a "This Month" totals card + an overdue/due-soon highlights line |
| Expenses tab | Paid log with its **own month picker**. Lists all paid expenses for the selected month (recurring paid that month + one-offs anchored to their `createdAt` month). Reuses `ExpenseCard` |
| Recurring tab | Today's `app/index.tsx` logic, greeting removed, filtered to `recurrence !== 'one-off'` |
| Auto-pay | One-off (regular) expenses are saved with `status='paid'` (in `db/expenses.ts` `insert`). Changes today's default of `'unpaid'` |
| Home behavior | Non-destructive — paid recurring still shows in the Recurring tab with its paid badge; it also appears in the Expenses tab |

## Architecture

### Route tree (after)

```
app/
  _layout.tsx            # Root Stack (unchanged providers); first route = (tabs)
  (tabs)/
    _layout.tsx          # <Tabs tabBar={FloatingTabBar}>; 3 Tabs.Screen, headerShown:false
    index.tsx            # Home  — slim dashboard (NEW content)
    expenses.tsx         # Expenses — paid log, own month picker (NEW)
    recurring.tsx        # Recurring — current index.tsx logic, no greeting, recurring-only
  expense/add.tsx        # Modal route (Stack level) — reads new `type` param
  settings.tsx           # Modal route (Stack level)
  settings/...           # unchanged
```

The root `app/_layout.tsx` keeps `GestureHandlerRootView` → `SafeAreaProvider` → `ExpenseProvider` → `BottomSheetModalProvider` → `Stack`. The `Stack` now renders the `(tabs)` group plus the existing modal-style routes. No provider changes.

### Component: `FloatingTabBar` (`components/FloatingTabBar.tsx`)

Rendered via `<Tabs tabBar={(props) => <FloatingTabBar {...props} />}>`. Receives the standard `BottomTabBarProps` (`state`, `navigation`). Responsibilities:

- Render a floating rounded pill (absolute, bottom inset via `useSafeAreaInsets`) with 3 segments: Home (`home`), Expenses (`check-circle`), Recurring (`repeat`). Active segment = `colors.primary`/`secondary`; inactive = `white/40`.
- Render a separate circular indigo FAB to the right of the pill, both on the same row.
- FAB `onPress` is derived from `state.routes[state.index].name`:
  - `index` (Home) → `router.push('/expense/add?type=regular')`
  - `expenses` → `router.push('/expense/add?type=regular')`
  - `recurring` → `router.push('/expense/add?type=recurring')`
- Tab press uses `navigation.navigate(route.name)` with the standard `tabPress` event guard.
- Styling: NativeWind classes; inline `style` only for the dynamic shadow (`shadowColor`) and the safe-area bottom offset. No `StyleSheet.create`.

### Tab: Home (`app/(tabs)/index.tsx`)

Slim dashboard, current-month context (no month navigator):

- Header row: `getFormattedDate()` label + `getGreeting(userName)` + settings gear (`router.push('/settings')`).
- "This Month" summary: reuse `KpiRow` with `{ year: currentYear, month: currentMonth }` (computes Total / Paid / Unpaid across **all** expenses in memory — already type-agnostic).
- Highlights line: overdue count + "due in next 7 days" count computed from `expenses` via `isOverdueOn` / `getDueDate`; tapping navigates to the Recurring tab (`router.push('/recurring')` or `navigation.navigate`).
- Empty state when `expenses.length === 0`: reuse `EmptyState` with `onAdd → /expense/add?type=regular`.
- No list body (keeps it slim). No FAB inside the screen — the FAB lives in `FloatingTabBar`.

### Tab: Expenses (`app/(tabs)/expenses.tsx`)

Paid log with own month picker:

- `MonthNavigator` (reused) with local `selectedYear`/`selectedMonth` state, defaulting to today.
- Derive paid list for the selected month from context (in-memory, no new DB query):
  - **Recurring** (`recurrence !== 'one-off'`) where `getMonthStatus(id, year, month) === 'paid'`.
  - **Regular** (`recurrence === 'one-off'`) where `status === 'paid'` **and** `createdAt`'s year/month === selected year/month (anchor consistent with current `index.tsx` one-off filter).
  - Sort ascending by `dueDay` (app convention).
- "Paid this month — `formatAmount(total)`" summary line above the list (sum of resolved amounts: variable → `getMonthAmount`, else `amount`).
- Render each with `ExpenseCard` (`referenceDate = new Date(year, month, 1)`). The card's `StatusBadge` toggle already lets the user un-pay — doing so drops the item from this list on re-render.
- Empty state: "No expenses paid in {Month}".

### Tab: Recurring (`app/(tabs)/recurring.tsx`)

Move today's `app/index.tsx` here, with two changes:

1. **Remove the greeting block** from the header (the date + `getGreeting`) **and the settings gear** (settings now lives on Home). The header collapses to just the `MonthNavigator`.
2. **Filter to recurring only** — every place that builds `currentMonthList` / `nextMonthList` / `flatList` operates on `expenses.filter(e => e.recurrence !== 'one-off')`. The existing one-off `createdAt` branch in the non-current-month path is removed (one-offs no longer appear here).
3. KPI row stays but now reflects recurring-only totals (because the source list is filtered). The FAB is removed from the screen (lives in `FloatingTabBar`).

### `app/expense/add.tsx` — `type` param

- Read `type` from `useLocalSearchParams<{ type?: 'regular' | 'recurring' }>()`.
- When **not** editing, set the default `recurrence`: `type === 'regular' ? 'one-off' : 'monthly'`.
- Recurrence picker stays visible and editable (user may still change it). No field hiding in this iteration (the full regular-vs-recurring form treatment is the separate, deferred `isRecurring` spec).

### `db/expenses.ts` — auto-pay one-off

- In `insert`, before writing: if `e.recurrence === 'one-off'`, force `status = 'paid'`. All other recurrences keep the passed status (`'unpaid'` default). `insertWithId` (backup restore) is left untouched so backups round-trip their stored status verbatim.

## Data Flow

- No schema migration. No new context actions. Both new tabs read from the existing `ExpenseContext` (`expenses`, `getMonthStatus`, `getMonthAmount`, `toggleMonthStatus`).
- Marking paid/unpaid anywhere updates `monthStatuses`/expense `status` in context → all three tabs recompute from the same source.

## Components & Reuse

| Unit | Source | Role |
|---|---|---|
| `FloatingTabBar` | NEW | Floating themed tab bar + context FAB |
| Home | NEW (`(tabs)/index.tsx`) | Slim summary dashboard |
| Expenses | NEW (`(tabs)/expenses.tsx`) | Paid log, month-pickered |
| Recurring | MOVED (`(tabs)/recurring.tsx`) | Current home, no greeting, recurring-only |
| `MonthNavigator` | reuse | Month picker (Expenses + Recurring) |
| `KpiRow` | reuse | Home summary + Recurring KPIs |
| `ExpenseCard` | reuse | Rows in Expenses + Recurring |
| `EmptyState` | reuse | Home / list empties |

## Out of Scope (YAGNI)

- The `isRecurring` column / form-field-hiding spec (`2026-05-31`) — deferred; we split on `recurrence`.
- "Credit expense" type (future) — design stays type-agnostic so it can slot in later.
- Tab transition animations beyond defaults; reordering tabs; per-tab settings.

## Verification

- App boots into the `(tabs)` group on Home; floating tab bar shows 3 segments + FAB; active segment is highlighted.
- Switching tabs preserves each tab's own state (Expenses/Recurring month selection independent).
- FAB opens `/expense/add` with the correct default recurrence: Home & Expenses → `one-off`; Recurring → `monthly`.
- Adding a regular (one-off) expense → saved `status='paid'`; appears immediately in the Expenses tab for its `createdAt` month; does **not** appear in Recurring.
- Adding a recurring expense → `status='unpaid'`; appears in Recurring; appears in Expenses only after being marked paid for a month.
- Recurring tab shows no greeting, no one-offs; KPIs reflect recurring only.
- Expenses tab month picker: paid recurring appears under the month it was paid; toggling a card to unpaid drops it from the list.
- Home summary totals match `KpiRow` for the current month; overdue/due-soon counts are accurate; tapping highlights navigates to Recurring.
- Modal routes (`expense/add`, `settings`) open full-screen over the tab bar.
- Deep links / `router.push` to `/expenses` and `/recurring` resolve.
