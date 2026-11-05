import React, { createContext, useContext, useMemo, useRef } from "react";
import { Alert } from "react-native";
import dayjs from "dayjs";
import { PaySheet, type PayConfirmation, type PaySheetRef, type PayTarget } from "@/components/PaySheet";
import { AppButton } from "@/components/ui/AppButton";
import { useExpenses, type UndoMonth } from "@/context/ExpenseContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { BillPaymentError } from "@/utils/expenses/BillPaymentError";
import { openExpense } from "@/utils/expenses/openExpense";
import { successHaptic } from "@/utils/haptics";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import { formatAmount } from "@/utils/formatAmount";
import { round } from "@/utils/round";
import type { AccountTransaction, Expense } from "@/types";

interface PayFlowValue {
  // Pays at once when the amount is known (with an Undo snackbar); otherwise opens the Pay sheet to ask.
  pay: (expense: Expense, year: number, month: number) => Promise<void>;
  unpay: (expense: Expense, year: number, month: number) => Promise<void>;
  // Always asks: amount, paid-on date and account. Use when the user wants to record details.
  openPaySheet: (expense: Expense, year: number, month: number) => void;
  // The Pay sheet for a bill row, with Details to open the bill's page.
  openBillSheet: (expense: Expense, year: number, month: number) => void;
  // The Pay sheet editing that one payment.
  openPaymentSheet: (expense: Expense, payment: AccountTransaction) => void;
  // Asks first, then deletes that one payment (with an Undo snackbar).
  deletePayment: (expense: Expense, payment: AccountTransaction) => Promise<void>;
}

const PayFlowContext = createContext<PayFlowValue | null>(null);

function cycleSuffix(year: number, month: number): string {
  const cycle = dayjs(new Date(year, month, 1));
  return cycle.isSame(dayjs(), "month") ? "" : ` for ${cycle.format("MMMM")}`;
}

export function PayFlowProvider({ children }: { children: React.ReactNode }) {
  const paySheetRef = useRef<PaySheetRef>(null);
  const {
    getBillProgress,
    getDisplayAmount,
    getMonthStatus,
    payMonth,
    payPart,
    updatePayment,
    deletePayment: deletePaymentRow,
    unpayMonth,
  } = useExpenses();
  const snackbar = useSnackbar();

  async function run(action: string, message: string, write: () => Promise<UndoMonth>) {
    try {
      const undo = await write();
      successHaptic();
      snackbar.show({ message, actionLabel: "Undo", onAction: undo });
    } catch (e) {
      console.error(`Couldn't ${action}`, e);
      const isRefused = e instanceof OverdraftError || e instanceof BillPaymentError;
      alertFailure(`${isRefused ? "Can't" : "Couldn't"} ${action}`, e);
    }
  }

  function mark(expense: Expense, year: number, month: number, verb: "paid" | "unpaid", write: () => Promise<UndoMonth>) {
    const title = expenseTitle(expense);
    return run(`mark ${title} ${verb}`, `${title}${cycleSuffix(year, month)} marked ${verb}`, write);
  }

  async function payOrAsk(target: PayTarget) {
    const { expense, year, month } = target;
    if (getDisplayAmount(expense, year, month) == null) {
      paySheetRef.current?.present(target);
      return;
    }
    await mark(expense, year, month, "paid", () => payMonth(expense.id, year, month));
  }

  function deletePayment(expense: Expense, payment: AccountTransaction): Promise<void> {
    const { cycleYear: year, cycleMonth: month } = payment;
    if (year == null || month == null) {
      return Promise.resolve();
    }
    const title = expenseTitle(expense);
    const reopens =
      getMonthStatus(expense.id, year, month) === "paid"
        ? ` ${dayjs(new Date(year, month, 1)).format("MMMM")} goes back to unpaid.`
        : "";
    const message = `${formatAmount(Math.abs(payment.amount))} paid ${dayjs(payment.createdAt).format("MMM D")}.${reopens}`;
    return new Promise((resolve) => {
      Alert.alert("Delete this payment?", message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await run(`delete ${title} payment`, `${title}${cycleSuffix(year, month)} payment deleted`, () =>
              deletePaymentRow(payment.id)
            );
            resolve();
          },
        },
      ]);
    });
  }

  function openBillSheet(target: PayTarget) {
    const { expense, year, month } = target;
    paySheetRef.current?.present(target, (dismiss) => (
      <AppButton
        label="Details"
        variant="tonal"
        onPress={() => {
          dismiss();
          openExpense(expense, year, month);
        }}
      />
    ));
  }

  const value = useMemo<PayFlowValue>(
    () => ({
      pay: (expense, year, month) => payOrAsk({ expense, year, month }),
      unpay: (expense, year, month) => mark(expense, year, month, "unpaid", () => unpayMonth(expense.id, year, month)),
      openPaySheet: (expense, year, month) => paySheetRef.current?.present({ expense, year, month }),
      openBillSheet: (expense, year, month) => openBillSheet({ expense, year, month }),
      openPaymentSheet: (expense, { id, cycleYear, cycleMonth }) => {
        if (cycleYear == null || cycleMonth == null) {
          return;
        }
        paySheetRef.current?.present({ expense, year: cycleYear, month: cycleMonth, paymentId: id });
      },
      deletePayment,
    }),
    [getDisplayAmount, getMonthStatus, payMonth, unpayMonth, deletePaymentRow, snackbar]
  );

  async function confirm({ expense, year, month, paymentId }: PayTarget, { mode, ...payment }: PayConfirmation) {
    const title = expenseTitle(expense);
    const suffix = cycleSuffix(year, month);
    if (mode === "edit") {
      if (paymentId != null) {
        await run(`save ${title} payment`, `${title}${suffix} payment saved`, () => updatePayment(paymentId, payment));
      }
      return;
    }
    if (mode === "part") {
      // This render can't see the write, so what's left is worked out from before it (a part never moves the bill).
      const { left } = getBillProgress(expense, year, month);
      const leftText = left == null ? "" : `, ${formatAmount(round(left - payment.amount, 2))} left`;
      await run(`pay ${title}`, `${title}${suffix}: ${formatAmount(payment.amount)} paid${leftText}`, () =>
        payPart(expense.id, year, month, payment)
      );
      return;
    }
    await mark(expense, year, month, "paid", () => payMonth(expense.id, year, month, payment));
  }

  return (
    <PayFlowContext.Provider value={value}>
      {children}
      <PaySheet ref={paySheetRef} onConfirm={confirm} />
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
