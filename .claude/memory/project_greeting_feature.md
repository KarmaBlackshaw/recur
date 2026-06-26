---
name: project-greeting-feature
description: "Home screen greeting + date feature — what was built, key decisions, gotchas"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9362bf8-7fe8-46dd-8745-ec9a2566893c
---

Home screen now shows time-of-day greeting ("Good Morning/Afternoon/Evening, [Name]") and current date instead of the static "Recur" title.

**Why:** User wanted a more personal, dynamic home screen header.

**What was built:**
- `utils/dateHelpers.ts` — `getGreeting(name?)` and `getFormattedDate()` pure helpers
- `db/preferences.ts` — `getPreference`, `setPreference`, `deletePreference` key/value SQLite helpers
- `db/schema.ts` — `prefs` table added; PRAGMA and CREATE TABLE separated into two execAsync calls (Android fix)
- `context/ExpenseContext.tsx` — `userName: string | null` state, `SET_USER_NAME` action, `setUserName` method
- `app/settings.tsx` — restored original settings screen + Profile section row added at top
- `app/settings/profile.tsx` — profile edit screen (name field, save/delete preference)

**Key gotcha — Android crash fix:**
Mixing `PRAGMA journal_mode = WAL` with `CREATE TABLE` statements in a single `db.execAsync()` call causes a NullPointerException on Android. Fix: split into two separate `execAsync` calls — PRAGMA first, then all CREATE TABLEs.

**Route structure:**
- `/settings` → `app/settings.tsx` (existing screen, Profile row added)
- `/settings/profile` → `app/settings/profile.tsx` (new)

**How to apply:** When touching DB schema or adding new tables, always keep PRAGMA calls separate from DDL.
