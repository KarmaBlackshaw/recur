import React, { createContext, useContext, useMemo, useRef } from "react";
import { Alert } from "react-native";
import dayjs from "dayjs";
import { PayConfirmSheet, type PayConfirmSheetRef } from "@/components/PayConfirmSheet";
import { PaySheet, type PayConfirmation, type PaySheetRef, type PayTarget } from "@/components/PaySheet";
import { AppButton } from "@/components/ui/AppButton";
import { useAccounts } from "@/context/AccountContext";
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
  // Asks to confirm in a sheet, then pays when the amount is known (with an Undo snackbar); otherwise opens the Pay sheet to ask.
  pay: (expense: Expense, year: number, month: number) => Promise<void>;
  // Asks first, then reverses every payment of the month (with an Undo snackbar).
  unpay: (expense: Expense, year: number, month: number) => Promise<void>;
  // Always asks: amount, paid-on date and account. Use when the user wants to record details.
  openPaySheet: (expense: Expense, year: number, month: number) => void;
  // The Pay sheet for a bill row, with Details to open the bill's page.
  openBillSheet: (expense: Expense, year: number, month: number) => void;
  // The Pay sheet editing that one payment.
  openPaymentSheet: (expense: Expense, payment: AccountTransaction) => void;
  // Asks first, then reverts that one payment (with an Undo snackbar).
  revertPayment: (expense: Expense, payment: AccountTransaction) => Promise<void>;
}

const PayFlowContext = createContext<PayFlowValue | null>(null);

function cycleSuffix(year: number, month: number): string {
  const cycle = dayjs(new Date(year, month, 1));
  return cycle.isSame(dayjs(), "month") ? "" : ` for ${cycle.format("MMMM")}`;
}

export function PayFlowProvider({ children }: { children: React.ReactNode }) {
  const paySheetRef = useRef<PaySheetRef>(null);
  const payConfirmRef = useRef<PayConfirmSheetRef>(null);
  const {
    getBillProgress,
    getMonthStatus,
    payMonth,
    payPart,
    updatePayment,
    revertPayment: revertPaymentRow,
    unpayMonth,
  } = useExpenses();
  const { getPayments } = useAccounts();
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

  async function payOrAsk(target: PayTarget): Promise<void> {
    const { expense, year, month } = target;
    if (getBillProgress(expense, year, month).bill == null) {
      paySheetRef.current?.present(target);
      return;
    }
    if (await payConfirmRef.current?.ask(target)) {
      await mark(expense, year, month, "paid", () => payMonth(expense.id, year, month));
    }
  }

  function unpay(expense: Expense, year: number, month: number): Promise<void> {
    const title = expenseTitle(expense);
    const count = getPayments(expense.id, year, month).length;
    const { paid } = getBillProgress(expense, year, month);
    const paidText = count === 0 ? "" : `${formatAmount(paid)} paid. `;
    const kept =
      count === 0
        ? ""
        : count === 1
          ? " The payment stays in the account history, marked as reverted."
          : ` ${count === 2 ? "Both" : `All ${count}`} payments stay in the account history, marked as reverted.`;
    const message = `${paidText}${dayjs(new Date(year, month, 1)).format("MMMM")} goes back to unpaid.${kept}`;
    return new Promise((resolve) => {
      Alert.alert(`Mark "${title}" unpaid?`, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Mark unpaid",
          style: "destructive",
          onPress: async () => {
            await mark(expense, year, month, "unpaid", () => unpayMonth(expense.id, year, month));
            resolve();
          },
        },
      ]);
    });
  }

  function revertPayment(expense: Expense, payment: AccountTransaction): Promise<void> {
    const { cycleYear: year, cycleMonth: month } = payment;
    if (year == null || month == null) {
      return Promise.resolve();
    }
    const title = expenseTitle(expense);
    const reopens =
      getMonthStatus(expense.id, year, month) === "paid"
        ? ` ${dayjs(new Date(year, month, 1)).format("MMMM")} goes back to unpaid.`
        : "";
    const message = `${formatAmount(Math.abs(payment.amount))} paid ${dayjs(payment.createdAt).format("MMM D")}.${reopens} The payment stays in the account history, marked as reverted.`;
    return new Promise((resolve) => {
      Alert.alert("Revert payment?", message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Revert",
          style: "destructive",
          onPress: async () => {
            await run(`revert ${title} payment`, `${title}${cycleSuffix(year, month)} payment reverted`, () =>
              revertPaymentRow(payment.id)
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
      unpay,
      openPaySheet: (expense, year, month) => paySheetRef.current?.present({ expense, year, month }),
      openBillSheet: (expense, year, month) => openBillSheet({ expense, year, month }),
      openPaymentSheet: (expense, { id, cycleYear, cycleMonth }) => {
        if (cycleYear == null || cycleMonth == null) {
          return;
        }
        paySheetRef.current?.present({ expense, year: cycleYear, month: cycleMonth, paymentId: id });
      },
      revertPayment,
    }),
    [getBillProgress, getMonthStatus, getPayments, payMonth, unpayMonth, revertPaymentRow, snackbar]
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
      <PayConfirmSheet ref={payConfirmRef} />
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
