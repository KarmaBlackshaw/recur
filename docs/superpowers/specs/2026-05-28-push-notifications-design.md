# Push Notifications — Design Spec

**Date:** 2026-05-28

## TL;DR

Add per-expense customizable reminders via `expo-notifications`. Each expense can have a `reminderDaysBefore` (1–14, or null for app default of 1). User sets a global preferred reminder time in Settings. All scheduling is centralized in a utility module and recomputed after every expense mutation.

## Data Model

### Schema change — `expenses` table

Add column:

```sql
ALTER TABLE expenses ADD COLUMN reminderDaysBefore INTEGER DEFAULT NULL;
```

`null` = use app default (1 day before). `0` = disabled. `1–14` = days before due.

### Preferences

`db/preferences.ts` already exists. Add two keys:

- `reminderTime` — stored as `"HH:MM"` string (24h), default `"09:00"`
- `notificationsEnabled` — stored as `"true"/"false"`, default `"true"`

## Architecture

### `utils/notifications.ts` (new)

Single responsibility: schedule and cancel notifications.

```ts
scheduleAllNotifications(expenses: Expense[], reminderTime: string): Promise<void>
cancelAllNotifications(): Promise<void>
requestPermissions(): Promise<boolean>
```

`scheduleAllNotifications`:
1. Cancel all pending notifications
2. For each expense where `status === 'unpaid'`:
   - Compute fire date: `getDueDate(dueDay) - (reminderDaysBefore ?? 1) days` at `reminderTime`
   - Skip if fire date is in the past
   - Schedule via `expo-notifications` with title = expense name, body = amount or "TBD"
3. No notification code anywhere else in the codebase

### `ExpenseContext` integration

After every mutation (add, update status, delete), call `scheduleAllNotifications`. Load `reminderTime` from preferences before calling.

### Permissions

Call `requestPermissions()` on first app launch (guarded by a `notificationsPermissionAsked` preference key). If denied, show a Settings banner: "Notifications disabled — enable in system settings."

## UI Changes

### `app/add-expense.tsx` (and edit flow if exists)

Add "Remind me" field below notes:

```
Remind me  [ 1 ] days before   (numeric input, 1–14, or clear to use default)
```

- Uses `AppTextInput` with `keyboardType="numeric"`
- `0` or empty = use default
- Validated: must be 1–14 or empty

### `app/settings.tsx`

New "Notifications" section:

```
Notifications
  Reminder time     [09:00]      (time picker)
  [Enable / Disable toggle]
```

Time picker: `AppSelectBottomSheet` with preset times every 30 min (06:00–22:00), or type custom. Persisted via `db/preferences.ts`.

### `ExpenseCard.tsx`

Small bell icon (`feather: bell`) shown when `reminderDaysBefore` is explicitly set (not null). Tapping does nothing — display only.

## Error Handling

- Permission denied: banner in Settings, no crash
- Scheduling error: log only, never surface to user (non-critical path)
- Past fire date: silently skip

## Verification

- [ ] Add expense with `reminderDaysBefore = 2` → notification scheduled 2 days before `dueDay` at configured time
- [ ] Mark expense paid → notification cancelled on next reschedule
- [ ] Delete expense → notification cancelled
- [ ] Change reminder time in Settings → all notifications rescheduled at new time
- [ ] Deny permissions → banner shown in Settings, no crash
- [ ] Expense with `amount = null` → notification body shows "TBD"
