# Search / Filter — Design Spec

**Date:** 2026-05-28

## TL;DR

Add inline search + filter to the home screen. Name search, category filter, and status filter operate on the in-memory expense list — no DB changes. When any filter is active, section grouping (Overdue/Upcoming/This Month/Next Month) collapses to a flat sorted list to avoid empty-section clutter.

## Filter State

New hook `utils/useSearchFilter.ts`:

```ts
interface FilterState {
  query: string;             // name search, case-insensitive substring
  category: string | null;  // null = all categories
  status: Status | null;    // null = all statuses
}

function useSearchFilter(expenses: Expense[]): {
  filterState: FilterState;
  setQuery: (q: string) => void;
  setCategory: (c: string | null) => void;
  setStatus: (s: Status | null) => void;
  clearAll: () => void;
  filteredExpenses: Expense[];
  isFiltering: boolean;  // true when any filter is active
}
```

`filteredExpenses` applies all active filters with AND logic. `isFiltering` drives conditional rendering in HomeScreen.

## UI

### Search bar

Toggled by tapping a search icon (`feather: search`) in the header, right of the date/greeting, left of the settings icon.

When open:
- `AppTextInput` slides in below the header (simple `useState` show/hide, no animation required)
- Placeholder: "Search expenses…"
- Clear button (`feather: x`) inside input when `query.length > 0`

### Filter chips

Appear below the search bar when it is open. Two chip groups:

**Category chips:** one chip per unique category present in `expenses` (derived dynamically). "All" chip = clear category filter.

**Status chips:** "All" | "Unpaid" | "Paid"

Active chip: filled background (`colors.primary`). Inactive: bordered, transparent.

### Header close button

`feather: x` on far right closes search bar and clears all filters.

### Active filter indicator

When search is closed but filters are still active (edge case — not possible with current design since closing clears all), this does not apply. Closing the search bar always calls `clearAll()`.

## HomeScreen Integration

```ts
const { filterState, filteredExpenses, isFiltering, ...actions } = useSearchFilter(expenses);
```

When `isFiltering`:
- Skip section computation entirely
- Render flat `FlatList` sorted by `dueDay` ascending
- Section headers replaced by single subheader: "X results"
- "No results" `EmptyState` variant when `filteredExpenses.length === 0`

When not `isFiltering`: existing `SectionList` logic unchanged.

## No DB Changes

All filtering is in-memory on `expenses` from `ExpenseContext`. Zero new queries.

## Verification

- [ ] Search by partial name (case-insensitive) filters list correctly
- [ ] Category chip filters to that category only
- [ ] Status chip filters to paid/unpaid
- [ ] Combined filters (name + category) apply with AND logic
- [ ] Flat list shown when any filter active; sections restored when cleared
- [ ] "X results" count accurate
- [ ] No results state shown when nothing matches
- [ ] Closing search bar clears all filters and restores sections
