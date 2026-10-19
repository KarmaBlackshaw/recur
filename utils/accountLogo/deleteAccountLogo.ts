import * as FileSystem from "expo-file-system/legacy";
import { resolveAccountLogo } from "@/utils/accountLogo/resolveAccountLogo";

export async function deleteAccountLogo(stored: string): Promise<void> {
  await FileSystem.deleteAsync(resolveAccountLogo(stored), { idempotent: true });
}
