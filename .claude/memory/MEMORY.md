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
