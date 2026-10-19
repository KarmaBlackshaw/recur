import * as FileSystem from "expo-file-system/legacy";
import { LOGO_DIR } from "@/utils/accountLogo/logoDir";

export async function saveAccountLogo(pickedUri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(LOGO_DIR, { intermediates: true });
  const extension = pickedUri.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: pickedUri, to: `${LOGO_DIR}${filename}` });
  return filename;
}
