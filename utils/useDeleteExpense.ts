import { Alert } from "react-native";
import { router } from "expo-router";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import type { Expense } from "@/types";

// Confirms before deleting an expense. A recurring expense with paid months gets the longer warning (its history
// leaves Activity and the totals, payments stay in balances) and the safer "Set end month" option.
export function useDeleteExpense() {
  const { deleteExpense, paidCycles } = useExpenses();
  const { transactions } = useAccounts();

  return function confirmDelete(expense: Expense, year: number, month: number, onDeleted?: () => void) {
    const title = expenseTitle(expense);
    const isRegular = expense.recurrence === "one-off";
    const remove = {
      text: "Delete",
      style: "destructive" as const,
      onPress: async () => {
        try {
          await deleteExpense(expense.id);
          onDeleted?.();
        } catch (e) {
          console.error("Delete expense failed", e);
          Alert.alert("Delete failed", "Something went wrong. Please try again.");
        }
      },
    };
    const paidMonths = isRegular ? 0 : paidCycles.filter((c) => c.expenseId === expense.id).length;
    if (paidMonths === 0) {
      Alert.alert("Delete expense", `Remove "${title}"?`, [{ text: "Cancel", style: "cancel" }, remove]);
      return;
    }
    const hasPayments = transactions.some((t) => t.kind === "payment" && t.expenseId === expense.id);
    const history = `Its ${paidMonths} paid ${paidMonths === 1 ? "month leaves" : "months leave"} Activity and the totals.`;
    const balances = hasPayments ? " The payments stay in your account balances." : "";
    Alert.alert(
      `Delete "${title}"?`,
      `${history}${balances}\n\nTo stop it and keep the history, set an end month instead.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set end month",
          onPress: () =>
            router.push({ pathname: "/expense/add", params: { id: expense.id, year, month, endPrompt: "1" } }),
        },
        remove,
      ]
    );
  };
}
