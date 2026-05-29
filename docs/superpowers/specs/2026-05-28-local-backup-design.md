# Local Backup (Export + Import) — Design Spec

**Date:** 2026-05-28

## TL;DR

Add JSON export via native share sheet and JSON import via document picker to the Settings screen. Export serializes all expenses + custom categories. Import merges by expense ID (skips duplicates). Uses `expo-file-system`, `expo-sharing`, and `expo-document-picker` — all in the Expo ecosystem, no native module changes.

## Export

### Flow

1. User taps "Export Data" in Settings
2. Load all expenses via `db/expenses.ts` `getAll()`
3. Load custom categories via `db/categories.ts` `getCustom()`
4. Serialize to JSON:

```ts
interface BackupFile {
  version: 1;
  exportedAt: string;       // ISO 8601
  expenses: Expense[];
  categories: string[];     // custom category names only
}
```

5. Write to `FileSystem.cacheDirectory + 'recur-backup-YYYY-MM-DD.json'` via `expo-file-system`
6. Open share sheet via `expo-sharing` `shareAsync(uri)`
7. User AirDrops / saves to Files / emails — standard OS share sheet

### Error handling

- `Sharing.isAvailableAsync()` check first. If false: `Alert` "Sharing not available on this device."
- Any write/share error: `Alert` with message. Never silent fail.

## Import

### Flow

1. User taps "Import Data" in Settings
2. `DocumentPicker.getDocumentAsync({ type: 'application/json' })` — filters to JSON
3. Read file content via `FileSystem.readAsStringAsync`
4. Parse and validate:
   - Must be valid JSON
   - Must have `version === 1`
   - `expenses` must be array; each item must have `id`, `name`, `category`, `dueDay`, `recurrence`, `status`, `createdAt`
   - `categories` must be array of strings
5. Merge expenses: for each imported expense, call `insert()` only if `id` not already in `getAll()` result
6. Merge categories: for each imported category, call `insertCustom()` only if not already present
7. Reload expenses in `ExpenseContext` (call existing `loadExpenses()`)
8. Show result: `Alert` "Import complete: X added, Y skipped (already exist)"

### Validation errors

- Invalid JSON → `Alert` "File is not valid JSON."
- Wrong version → `Alert` "Unsupported backup version."
- Missing required fields on any expense → `Alert` "Backup file is corrupted — missing required fields."
- User cancels picker → no-op, no alert

## UI: `app/settings.tsx`

New "Data" section at bottom of settings screen:

```
── Data ────────────────────────
  Export Data      [arrow icon]
  Import Data      [arrow icon]
```

Both are `TouchableOpacity` rows matching existing settings row style.

## Packages

All already in Expo SDK — install if not present:
- `expo-file-system`
- `expo-sharing`
- `expo-document-picker`

Check `package.json` before installing.

## Verification

- [ ] Export produces valid JSON with correct schema
- [ ] Exported file opens via share sheet (AirDrop / Files)
- [ ] Import adds new expenses not already in DB
- [ ] Import skips expenses with matching `id` (no duplicates)
- [ ] Import result alert shows correct added/skipped counts
- [ ] Invalid JSON file → clear error alert
- [ ] Corrupted backup (missing fields) → clear error alert
- [ ] Custom categories imported and visible in category picker
- [ ] ExpenseContext reloads after import — home screen reflects changes immediately
