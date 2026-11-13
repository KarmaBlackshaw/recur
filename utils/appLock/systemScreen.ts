let openCount = 0;

// Pickers, the share sheet and permission dialogs are their own screens on Android, so opening one sends Recur to the
// background. App lock reads this to tell them from leaving the app.
export async function openSystemScreen<T>(open: () => Promise<T>): Promise<T> {
  openCount += 1;
  try {
    return await open();
  } finally {
    openCount -= 1;
  }
}

export function isSystemScreenOpen(): boolean {
  return openCount > 0;
}
