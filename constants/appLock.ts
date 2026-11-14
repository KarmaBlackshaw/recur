// 0 locks App lock every time Recur leaves the foreground.
export const LOCK_AFTER_MINUTES = [0, 1, 5, 15] as const;
export const DEFAULT_LOCK_AFTER_MINUTES = 1;
