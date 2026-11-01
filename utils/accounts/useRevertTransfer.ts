import { Alert } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { splitTransfer } from "@/utils/accounts/splitTransfer";

export function useRevertTransfer() {
  const accounts = useAccounts();

  return (transferId: string, runAction: (revert: () => Promise<void>) => void = (revert) => revert()) => {
    const rows = accounts.transactions.filter((t) => t.transferId === transferId);
    const { isBillPayment } = splitTransfer(rows, accounts.accounts);

    const revert = async () => {
      try {
        await accounts.deleteTransfer(transferId);
      } catch (e) {
        console.error("Revert transfer failed", e);
        alertFailure("Revert failed", e);
      }
    };

    Alert.alert(
      isBillPayment ? "Revert payment?" : "Revert transfer?",
      isBillPayment
        ? "This payment and any fee are removed. The money goes back to its account and the card owes it again."
        : "Both sides of this transfer and any fee or income recorded with it are removed, and the balances restored.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Revert", style: "destructive", onPress: () => runAction(revert) },
      ]
    );
  };
}
