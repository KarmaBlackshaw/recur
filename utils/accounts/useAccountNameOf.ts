import { useAccounts } from "@/context/AccountContext";

export function useAccountNameOf(): (id: string | null | undefined) => string | undefined {
  const accounts = useAccounts();
  return (id) => accounts.accounts.find((account) => account.id === id)?.name;
}
