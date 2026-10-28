import { router } from "expo-router";
import type { TOverdraft } from "@/utils/accounts/findOverdraft";

export function transferIn({ account, shortfall }: TOverdraft) {
  router.push({ pathname: "/transfer", params: { toAccountId: account.id, amount: shortfall.toFixed(2) } });
}
