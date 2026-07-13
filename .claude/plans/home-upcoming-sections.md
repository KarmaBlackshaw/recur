# Plan: Home tab — Overdue / Upcoming / Recently Paid sections

## TL;DR
Home tab's single mixed day-grouped list is split into three labeled category sections: **Overdue** (flat), **Upcoming** (keeps per-day grouping), **Recently Paid** (flat). Same data + same rolling 1/7/15-day window — purely a regrouping so the user sees "what's late", "what's coming", and "what's done" as distinct blocks. Shared `DayGroupedExpenseList` (used by 3 tabs) is untouched in behavior; the day-header row is extracted to a small shared component for reuse.

## ASCII layout

BEFORE — one mixed day-grouped list (overdue + upcoming + paid interleaved by day):
```
THIS MONTH
[ Total  Paid  Unpaid ]
( 1 · 7 · 15 )

15  TUE  Jul        ₱15,149
  Rent             ₱15,000 [ ]
  Spotify          ₱149    [ ]
10  THU  Jul           ₱800
  Water (paid)     ₱800    ✓
 5  SUN  Jul           ₱549
  Netflix ⚠        ₱549    [ ]    ← overdue buried between paid/upcoming
```

AFTER — three category sections:
```
THIS MONTH
[ Total  Paid  Unpaid ]
( 1 · 7 · 15 )

⚠ OVERDUE                ₱549     ← flat band + section total
  Netflix   ⚠ 8 days     ₱549 [ ] ← card shows date inline (hideDate=false)

▲ UPCOMING            ₱15,149     ← band + grand total
  15  TUE  Jul        ₱15,149     ← per-day header KEPT
    Rent             ₱15,000 [ ]
    Spotify          ₱149    [ ]

✓ RECENTLY PAID           ₱800    ← flat band + section total
  Water      Jul 10       ₱800  ✓ ← card shows paid date (hideDate=false)
```
Empty categories render nothing (no empty band). All three empty → existing "Nothing due or paid…" message.

## Decisions (locked via Q&A + defaults)
- Overdue = recurring, unpaid, `isOverdueOn` true. **Always shown** regardless of window (matches current behavior). Flat, sorted by due date ascending (most overdue first).
- Upcoming = recurring, unpaid, NOT overdue, due date within `[today, today+windowDays]`. **Day-grouped**, ascending (soonest first).
- Recently Paid = ledger entries with `effDate` in `[today-windowDays, endToday]`. Flat, descending (most recent first). *(Default: flat — user only specified Upcoming keeps day grouping.)*
- Each band header shows its section total on the right (parity with existing day headers).

## Implementation steps
1. **[low]** New `components/DayHeaderRow.tsx` — extract the day-number + weekday + month + right-aligned total row, and the `weekdayColor()` helper, from `DayGroupedExpenseList`. Export both. Pure presentational, behavior-identical.
2. **[low]** `components/DayGroupedExpenseList.tsx` — replace the inline day-header markup in `renderSectionHeader` with `<DayHeaderRow date={s.date} total={s.dayTotal} />`; import `weekdayColor`/drop local copy. **No prop/API change.**
3. **[med]** New `components/HomeExpenseSections.tsx` — props `{ overdue, upcoming, recentlyPaid, ListHeaderComponent, ListEmptyComponent }` (all `DayEntry[]`). Build a `SectionList` with a discriminated section model:
   - `flat` sections (Overdue, Recently Paid): band header (icon + label + total), rows render `ExpenseCard hideDate={false}`.
   - `day` sections (Upcoming, one per day): first day carries the "UPCOMING" band label above the `<DayHeaderRow>`; rows render `ExpenseCard hideDate={true}`.
   - Skip a category entirely when its array is empty. Reuse existing `pb-[140px]`, `stickySectionHeadersEnabled={false}`.
4. **[med]** `app/(tabs)/index.tsx` — split the current single `entries` memo into three memoized arrays (`overdue`, `upcoming`, `recentlyPaid`) using the exact same filters already present, and render `<HomeExpenseSections … />` in place of `<DayGroupedExpenseList entries={entries} />`. Keep `ListHeaderComponent` (This Month + KpiRow + DayWindowSelector) and `ListEmptyComponent` unchanged.

## Executor prompt
> Repo: `/Users/admin/Documents/personal/recur` (React Native / Expo Router, TypeScript, NativeWind v4 — NO `StyleSheet.create`, inline `style={{}}` only for dynamic values). Icons: `@expo/vector-icons` Feather. Dates: dayjs. Colors from `constants/theme` (`colors.overdue`, `colors.paid`, `colors.secondary`, `colors.textMuted`).
>
> Goal: On the home tab, replace the single mixed `DayGroupedExpenseList` with three labeled category sections — **Overdue** (flat), **Upcoming** (day-grouped, keep the existing day headers), **Recently Paid** (flat) — using the same data and the same 1/7/15-day window that `app/(tabs)/index.tsx` already computes.
>
> Do NOT change `DayGroupedExpenseList`'s public props (it's shared by `recurring.tsx`, `expenses.tsx`, `index.tsx`).
>
> 1. Create `components/DayHeaderRow.tsx`: move the day-header row markup (`D` big number, `ddd` weekday colored via `weekdayColor`, `MMM YYYY`, right-aligned `formatAmount(total)`) and the `weekdayColor(date)` helper out of `components/DayGroupedExpenseList.tsx`. Export `DayHeaderRow` (props `{ date: Date; total: number }`) and `weekdayColor`.
> 2. In `DayGroupedExpenseList.tsx`, use `<DayHeaderRow date={s.date} total={s.dayTotal} />` inside `renderSectionHeader`; import `weekdayColor` if still needed there (it isn't after extraction). No behavior/API change.
> 3. Create `components/HomeExpenseSections.tsx`. Props: `{ overdue: DayEntry[]; upcoming: DayEntry[]; recentlyPaid: DayEntry[]; ListHeaderComponent?; ListEmptyComponent? }` (import `DayEntry` from `DayGroupedExpenseList`). Build a `SectionList`:
>    - Discriminated section model. `flat` sections for Overdue and Recently Paid render a band header: Feather icon + uppercase label (Quicksand_700Bold, tracking-widest, 11px) + right-aligned `formatAmount(sectionTotal)`; Overdue uses `colors.overdue` + `alert-triangle`, Recently Paid uses `colors.paid` + `check-circle`. Rows: `<ExpenseCard expense refDate=item.refDate hideDate={false} onPress=… />` (same onPress nav as DayGroupedExpenseList).
>    - `day` sections for Upcoming (one per calendar day, built like DayGroupedExpenseList groups by `dayjs(effDate).format('YYYY-MM-DD')`). The FIRST upcoming day section renders an "UPCOMING" band label (Feather `trending-up` or `arrow-up-circle`, `colors.secondary`) with the grand upcoming total, ABOVE a `<DayHeaderRow>`; later day sections render only `<DayHeaderRow>`. Rows: `<ExpenseCard … hideDate={true} />`.
>    - Omit any category whose array is empty. `stickySectionHeadersEnabled={false}`, `contentContainerClassName="pb-[140px]"`, `showsVerticalScrollIndicator={false}`. Pass through `ListHeaderComponent`/`ListEmptyComponent`.
> 4. In `app/(tabs)/index.tsx`, split the existing `entries` useMemo into three memos with the SAME filters already there:
>    - `overdue`: recurring, `getMonthStatus===unpaid`, `isOverdueOn(e.dueDay,year,month)` true. Sort by `effDate` asc.
>    - `upcoming`: recurring, unpaid, NOT overdue, `getDueDate(e.dueDay)` within `[today, today+windowDays]`. Sort by `effDate` asc.
>    - `recentlyPaid`: current `ledger.filter(effDate in [today-windowDays, endToday])`. Sort by `effDate` desc.
>    Each entry keeps the same shape it has now (`key, expense, effDate, refDate, amount`), but set `hideDate`/`compact` in the component, not here. Render `<HomeExpenseSections overdue={overdue} upcoming={upcoming} recentlyPaid={recentlyPaid} ListHeaderComponent={…} ListEmptyComponent={…} />`. Keep the `expenses.length===0 → EmptyState` branch and the header untouched.
>
> Verify: `npx tsc --noEmit` clean. No `StyleSheet.create`. `DayGroupedExpenseList` still compiles for `recurring.tsx`/`expenses.tsx`.

## Verification
- `npx tsc --noEmit` passes.
- Home tab: overdue expense appears under "OVERDUE" with its date inline; future dues appear under "UPCOMING" with day headers; paid-this-window under "RECENTLY PAID".
- Switching 1/7/15 selector still filters Upcoming + Recently Paid; Overdue stays visible regardless.
- Empty categories hidden; all-empty shows existing message.
- `recurring` + `expenses` tabs still render (shared component intact).
- No `StyleSheet.create`; NativeWind classes only.
