import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";

let openCount = 0;

// Pickers, the share sheet and permission dialogs are their own screens on Android, so opening one sends Recur to the
// background. App lock reads isSystemScreenOpen to tell them from leaving the app, so every one must open through this file.
async function openSystemScreen<T>(open: () => Promise<T>) {
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

export function pickDocument(options: DocumentPicker.DocumentPickerOptions) {
  return openSystemScreen(() => DocumentPicker.getDocumentAsync(options));
}

export async function shareFile(uri: string, options: Sharing.SharingOptions) {
  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    throw new Error("Sharing not available on this device.");
  }
  await openSystemScreen(() => Sharing.shareAsync(uri, options));
}

export function pickImage(options: ImagePicker.ImagePickerOptions) {
  return openSystemScreen(() => ImagePicker.launchImageLibraryAsync(options));
}

export function requestNotificationPermission() {
  return openSystemScreen(() => Notifications.requestPermissionsAsync());
}
