import React, { createContext, useContext, useMemo, useRef } from "react";
import { Alert } from "react-native";
import dayjs from "dayjs";
import { PaySheet, type PayConfirmation, type PaySheetRef, type PayTarget } from "@/components/PaySheet";
import { useExpenses, type UndoMonth } from "@/context/ExpenseContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { successHaptic } from "@/utils/haptics";
import type { Expense } from "@/types";

interface PayFlowValue {
  // Pays at once when the amount is known (with an Undo snackbar); otherwise opens the Pay sheet to ask.
  pay: (expense: Expense, year: number, month: number) => Promise<void>;
  unpay: (expense: Expense, year: number, month: number) => Promise<void>;
  // Always asks: amount, paid-on date and account. Use when the user wants to record details.
  openPaySheet: (expense: Expense, year: number, month: number) => void;
}

const PayFlowContext = createContext<PayFlowValue | null>(null);

function cycleSuffix(year: number, month: number): string {
  const cycle = dayjs(new Date(year, month, 1));
  return cycle.isSame(dayjs(), "month") ? "" : ` for ${cycle.format("MMMM")}`;
}

export function PayFlowProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<PaySheetRef>(null);
  const { getDisplayAmount, payMonth, unpayMonth } = useExpenses();
  const snackbar = useSnackbar();

  async function run(expense: Expense, year: number, month: number, verb: "paid" | "unpaid", write: () => Promise<UndoMonth>) {
    const title = expenseTitle(expense);
    try {
      const undo = await write();
      successHaptic();
      snackbar.show({
        message: `${title}${cycleSuffix(year, month)} marked ${verb}`,
        actionLabel: "Undo",
        onAction: undo,
      });
    } catch (e) {
      console.error(`Mark ${verb} failed`, e);
      Alert.alert(`Couldn't mark ${title} ${verb}`, "Something went wrong. Please try again.");
    }
  }

  const value = useMemo<PayFlowValue>(
    () => ({
      pay: async (expense, year, month) => {
        if (getDisplayAmount(expense, year, month) == null) {
          sheetRef.current?.present({ expense, year, month });
          return;
        }
        await run(expense, year, month, "paid", () => payMonth(expense.id, year, month));
      },
      unpay: (expense, year, month) => run(expense, year, month, "unpaid", () => unpayMonth(expense.id, year, month)),
      openPaySheet: (expense, year, month) => sheetRef.current?.present({ expense, year, month }),
    }),
    [getDisplayAmount, payMonth, unpayMonth, snackbar]
  );

  async function confirm({ expense, year, month }: PayTarget, payment: PayConfirmation) {
    await run(expense, year, month, "paid", () => payMonth(expense.id, year, month, payment));
  }

  return (
    <PayFlowContext.Provider value={value}>
      {children}
      <PaySheet ref={sheetRef} onConfirm={confirm} />
    </PayFlowContext.Provider>
  );
}

export function usePayFlow() {
  const ctx = useContext(PayFlowContext);
  if (!ctx) {
    throw new Error("usePayFlow must be used within PayFlowProvider");
  }
  return ctx;
}
