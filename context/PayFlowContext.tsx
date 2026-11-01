import React, { createContext, useContext, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { PaySheet, type PayConfirmation, type PaySheetRef, type PayTarget } from "@/components/PaySheet";
import { BillSheet, type BillSheetRef } from "@/components/BillSheet";
import type { SheetFooter } from "@/components/ui/AppBottomSheet";
import { useExpenses, type UndoMonth } from "@/context/ExpenseContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { successHaptic } from "@/utils/haptics";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import type { Expense } from "@/types";

interface PayFlowValue {
  // Pays at once when the amount is known (with an Undo snackbar); otherwise opens the Pay sheet to ask.
  pay: (expense: Expense, year: number, month: number) => Promise<void>;
  unpay: (expense: Expense, year: number, month: number) => Promise<void>;
  // Always asks: amount, paid-on date and account. Use when the user wants to record details.
  openPaySheet: (expense: Expense, year: number, month: number) => void;
  openBillSheet: (expense: Expense, year: number, month: number) => void;
}

const PayFlowContext = createContext<PayFlowValue | null>(null);

function cycleSuffix(year: number, month: number): string {
  const cycle = dayjs(new Date(year, month, 1));
  return cycle.isSame(dayjs(), "month") ? "" : ` for ${cycle.format("MMMM")}`;
}

export function PayFlowProvider({ children }: { children: React.ReactNode }) {
  const paySheetRef = useRef<PaySheetRef>(null);
  const billSheetRef = useRef<BillSheetRef>(null);
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
      alertFailure(e instanceof OverdraftError ? `Can't mark ${title} ${verb}` : `Couldn't mark ${title} ${verb}`, e);
    }
  }

  async function payOrAsk(target: PayTarget, footer?: SheetFooter) {
    const { expense, year, month } = target;
    if (getDisplayAmount(expense, year, month) == null) {
      paySheetRef.current?.present(target, footer);
      return;
    }
    await run(expense, year, month, "paid", () => payMonth(expense.id, year, month));
  }

  const value = useMemo<PayFlowValue>(
    () => ({
      pay: (expense, year, month) => payOrAsk({ expense, year, month }),
      unpay: (expense, year, month) => run(expense, year, month, "unpaid", () => unpayMonth(expense.id, year, month)),
      openPaySheet: (expense, year, month) => paySheetRef.current?.present({ expense, year, month }),
      openBillSheet: (expense, year, month) => billSheetRef.current?.present({ expense, year, month }),
    }),
    [getDisplayAmount, payMonth, unpayMonth, snackbar]
  );

  async function confirm({ expense, year, month }: PayTarget, payment: PayConfirmation) {
    await run(expense, year, month, "paid", () => payMonth(expense.id, year, month, payment));
  }

  return (
    <PayFlowContext.Provider value={value}>
      {children}
      <PaySheet ref={paySheetRef} onConfirm={confirm} />
      <BillSheet ref={billSheetRef} onPay={payOrAsk} />
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
