import { LOGO_DIR } from "@/utils/accountLogo/logoDir";

export function resolveAccountLogo(stored: string): string {
  if (!stored.includes("/")) {
    return `${LOGO_DIR}${stored}`;
  }
  if (stored.includes("/account-logos/")) {
    return `${LOGO_DIR}${stored.split("/").pop()}`;
  }
  return stored;
}
