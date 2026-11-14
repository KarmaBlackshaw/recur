// Keys in the `prefs` table (db/preferences.ts) added by the UX pass. Older keys are still inline string literals.
export const PREF_LAST_BACKUP_AT = "lastBackupAt";
export const PREF_BACKUP_NUDGE_SNOOZED_AT = "backupNudgeSnoozedAt";
export const PREF_SETUP_CHECKLIST_DISMISSED = "setupChecklistDismissed";
export const PREF_SWIPE_HINT_SEEN = "swipeHintSeen";
export const PREF_NOTIFICATIONS_PERMISSION_ASKED = "notificationsPermissionAsked";
export const PREF_NOTIFICATIONS_ENABLED = "notificationsEnabled";
export const PREF_REMINDER_TIME = "reminderTime";
// App lock stays on this phone: it isn't in backups (BACKUP_PREFERENCE_KEYS), since another phone may have no screen lock.
export const PREF_APP_LOCK_ENABLED = "appLockEnabled";
export const PREF_APP_LOCK_AFTER_MINUTES = "appLockAfterMinutes";
