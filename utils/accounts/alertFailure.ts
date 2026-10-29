import { Alert } from "react-native";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import { transferIn } from "@/utils/accounts/transferIn";

export function alertFailure(title: string, error: unknown) {
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
