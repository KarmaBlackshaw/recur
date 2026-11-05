import { Alert } from "react-native";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import { transferIn } from "@/utils/accounts/transferIn";
import { BillPaymentError } from "@/utils/expenses/BillPaymentError";

export function alertFailure(title: string, error: unknown) {
  if (error instanceof BillPaymentError) {
    Alert.alert(title, error.message);
    return;
  }
  if (!(error instanceof OverdraftError)) {
    Alert.alert(title, "Something went wrong. Please try again.");
    return;
  }
  Alert.alert(
    title,
    error.message,
    error.account.archivedAt
      ? undefined
      : [
          { text: "Cancel", style: "cancel" },
          { text: "Transfer in", onPress: () => transferIn(error) },
        ]
  );
}
