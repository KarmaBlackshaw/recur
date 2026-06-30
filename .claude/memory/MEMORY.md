# Recur Project Memory

## Entries

### [project-greeting-feature](./project_greeting_feature.md)
- **Type:** project
- **Summary:** Home screen greeting + date feature — what was built, key decisions, gotchas
- **Key fact:** Android crash fix — split PRAGMA and CREATE TABLE into separate `execAsync` calls

### [feedback-db-pragma-android](./feedback_db_pragma.md)
- **Type:** feedback
- **Summary:** Android SQLite gotcha — separate PRAGMA from CREATE TABLE in execAsync
- **Key fact:** Mixing PRAGMA with DDL in a single `execAsync` causes NullPointerException on Android; always run PRAGMA in its own call first

### [tabbed-navigation-feature](./tabbed_navigation_feature.md)
- **Type:** project
- **Summary:** 3-tab nav (Home/Expenses/Recurring) via expo-router `(tabs)` group + custom FloatingTabBar; type split on `recurrence`, one-offs auto-paid on insert
- **Key fact:** `@react-navigation/bottom-tabs` is NOT installed → `BottomTabBarProps` typed `any`; baseline tsc noise = global.css TS2882 + DraggableList SharedValue TS2694 ×4

### [regular-vs-recurring-add-form](./regular_vs_recurring_add_form.md)
- **Type:** project
- **Summary:** Add/Edit form hides Variable/DueDay/Recurrence/Remind-me for regular (one-off) expenses; `isRegular` derived from `type` param / `recurrence==='one-off'`, no DB change, picker drops One-off
- **Key fact:** dueDay stays NOT NULL (no migration) — regular stores sentinel `1`, never shown; ExpenseCard shows `createdAt` date for one-off rows instead of a due date

### [home-recent-paid-date](./home_recent_paid_date.md)
- **Type:** project
- **Summary:** Home gains a 3rd section "Recently Paid — Last 7 days" + new `paid_date` column / form date-picker field for one-offs; recurring anchored on due date, one-offs on `paidDate`
- **Key fact:** migration `migrated_paid_date_v1` (ALTER expenses ADD paid_date TEXT, backfill from createdAt); one-off insert defaults paidDate to today; `@react-native-community/datetimepicker` now in use; Expenses tab still anchors one-offs to `createdAt` (not paidDate)

### [recurring-end-date-feature](./recurring_end_date_feature.md)
- **Type:** project
- **Summary:** Optional **end month** for recurring expenses — `endYear`/`endMonth` columns + `isEndedOn` helper; post-end months render greyed "ENDED" (bottom Ended section), excluded from due/overdue/KPI/reminders
- **Key fact:** migration `migrated_expense_end_v1` (two separate ALTERs: end_year/end_month INTEGER, NULL=open-ended, forced null for one-off); end **month** granularity not full date; tsc baseline still 5 errors — DraggableList ones carry a node_modules path so `grep -v node_modules` hides them

### [home-upcoming-always-shown](./home_upcoming_always_shown.md)
- **Type:** project
- **Summary:** Home "Upcoming — Next 7 Days" section always renders (header + empty-state placeholder); 7-day window kept
- **Key fact:** `Section.emptyHint?` drives a generic `renderSectionFooter` placeholder; Upcoming pushed unconditionally; dead `ListEmptyComponent` removed (sections always ≥1 once expenses exist)

### [add-form-focus-chain](./add_form_focus_chain.md)
- **Type:** project
- **Summary:** Auto-focus chain in Add/Edit form — Name→Amount auto-focus + Category-pick→Due Day focus. (Amount→Category "Next" button was tried then REMOVED at user request.)
- **Key fact:** **Tap target for the next-step MUST live INSIDE the ScrollView** (which has `keyboardShouldPersistTaps="handled"`). A floating bar OUTSIDE the ScrollView never gets its `onPress` while the keyboard is up — the OS eats the first outside-tap dismissing the IME (Android `adjustResize` also resizes the window away). Earlier `KeyboardNextBar` (deleted) failed for this reason; blur-unmount and positioning were red herrings. Due-Day focus fires on sheet `onDismiss` gated by `pendingDueFocus` ref; `AppTextInput` now `forwardRef`. Cross-platform on-keyboard control would need `react-native-keyboard-controller` (`InputAccessoryView` is iOS-only).

### [home-day-window-selector](./home_day_window_selector.md)
- **Type:** project
- **Summary:** Home segmented pill `1 Day / 7 Days / 15 Days` (`DayWindowSelector`) under KpiRow; `windowDays` state (default 7) drives both Upcoming (+N) and Recently Paid (−N) windows
- **Key fact:** Pure in-memory filter, no DB change; replaced hardcoded `in7`/`last7` with `addDays(today, ±windowDays)`; section titles are static `"Upcoming"` / `"Recently Paid"` (pill is the window indicator, not the header); `windowLabel(days)` still used in Upcoming empty hint; Overdue untouched; `windowDays` in `useMemo` deps
