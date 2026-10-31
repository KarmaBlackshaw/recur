import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import dayjs from "dayjs";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import { round } from "@/utils/round";
import { keyBy, uniq } from "@/utils/collections";
import {
  getAll as getAllLoans,
  insert as insertLoan,
  update as updateLoanRow,
  remove as removeLoan,
  insertPayments,
} from "@/db/loans";
import { remove as removeTransaction, updateLoanPayment } from "@/db/accountTransactions";
import { useAccounts } from "@/context/AccountContext";
import { summarizeLoan, type TLoanSummary } from "@/utils/loans/summarizeLoan";
import { useToday } from "@/utils/useToday";
import type { AccountTransaction, Loan, LoanExcessInput, LoanInput, LoanPaymentInput } from "@/types";

interface State {
  loans: Loan[];
  isLoading: boolean;
}

type Action =
  | { type: "LOAD"; payload: Loan[] }
  | { type: "ADD_LOAN"; payload: Loan }
  | { type: "UPDATE_LOAN"; payload: Loan }
  | { type: "REMOVE_LOAN"; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { loans: action.payload, isLoading: false };
    case "ADD_LOAN":
      return { ...state, loans: [action.payload, ...state.loans] };
    case "UPDATE_LOAN":
      return { ...state, loans: state.loans.map((l) => (l.id === action.payload.id ? action.payload : l)) };
    case "REMOVE_LOAN":
      return { ...state, loans: state.loans.filter((l) => l.id !== action.payload) };
    default:
      return state;
  }
}

interface LoanContextValue {
  loans: Loan[];
  isLoading: boolean;
  summaries: Record<string, TLoanSummary>;
  paymentsOf: (loanId: string) => AccountTransaction[];
  borrowerOf: (loanId: string | null) => string | undefined;
  addLoan: (input: LoanInput) => Promise<void>;
  updateLoan: (id: string, input: LoanInput) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  recordPayments: (payments: LoanPaymentInput[], excess?: LoanExcessInput) => Promise<void>;
  updatePayment: (txnId: string, p: LoanPaymentInput) => Promise<void>;
  deletePayment: (txnId: string) => Promise<void>;
  reload: () => Promise<void>;
}

const LoanContext = createContext<LoanContextValue | null>(null);

export function LoanProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { loans: [], isLoading: true });
  const accounts = useAccounts();

  const reload = useMemoizedFn(async () => {
    const loans = await getAllLoans();
    dispatch({ type: "LOAD", payload: loans });
  });

  useAsyncEffect(async function* () {
    try {
      const loans = await getAllLoans();
      yield;
      dispatch({ type: "LOAD", payload: loans });
    } catch (e) {
      console.error(e);
      yield;
      dispatch({ type: "LOAD", payload: [] });
    }
  }, []);

  const paymentsOf = useCallback(
    (loanId: string) => accounts.transactions.filter((t) => t.loanId === loanId && t.kind === "loan_in"),
    [accounts.transactions]
  );

  const loansById = useMemo(() => keyBy(state.loans, "id"), [state.loans]);
  const borrowerOf = useCallback(
    (loanId: string | null) => (loanId == null ? undefined : loansById[loanId]?.borrower),
    [loansById]
  );

  const today = dayjs(useToday()).format("YYYY-MM-DD");

  const summaries = useMemo(() => {
    const map: Record<string, TLoanSummary> = {};
    for (const loan of state.loans) {
      map[loan.id] = summarizeLoan({ loan, payments: paymentsOf(loan.id), today });
    }
    return map;
  }, [state.loans, paymentsOf, today]);

  const assertDepositAccount = (accountId: string) => {
    const account = accounts.accounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error("Account not found");
    }
    if (account.type === "credit") {
      throw new Error("Loans can't use a credit card");
    }
    if (account.archivedAt) {
      throw new Error("Loans can't use an archived account");
    }
  };

  const addLoan = useMemoizedFn(async (input: LoanInput) => {
    assertDepositAccount(input.accountId);
    const principal = round(input.principal, 2);
    const error = accounts.overdraftError([{ accountId: input.accountId, amount: -principal }]);
    if (error) {
      throw error;
    }
    const loan = await insertLoan({ ...input, principal });
    dispatch({ type: "ADD_LOAN", payload: loan });
    await accounts.reload();
  });

  const updateLoan = useMemoizedFn(async (id: string, input: LoanInput) => {
    const existing = state.loans.find((l) => l.id === id);
    if (!existing) {
      throw new Error("Loan not found");
    }
    if (input.accountId !== existing.accountId) {
      assertDepositAccount(input.accountId);
    }
    const next = { ...input, principal: round(input.principal, 2) };
    const candidate = summarizeLoan({ loan: next, payments: paymentsOf(id), today });
    if (!candidate.isValid) {
      throw new Error("Payments exceed this loan");
    }
    const error = accounts.overdraftError(
      [{ accountId: input.accountId, amount: -next.principal }],
      (t) => t.loanId === id && t.kind === "loan_out"
    );
    if (error) {
      throw error;
    }
    await updateLoanRow(id, next);
    dispatch({ type: "UPDATE_LOAN", payload: { ...existing, ...next } });
    await accounts.reload();
  });

  const deleteLoan = useMemoizedFn(async (id: string) => {
    const error = accounts.overdraftError([], (t) => t.loanId === id);
    if (error) {
      throw error;
    }
    await removeLoan(id);
    dispatch({ type: "REMOVE_LOAN", payload: id });
    await accounts.reload();
  });

  const recordPayments = useMemoizedFn(async (payments: LoanPaymentInput[], excess?: LoanExcessInput) => {
    if (payments.length === 0) {
      throw new Error("Nothing to record");
    }
    const loanIds = uniq(payments.map(({ loanId }) => loanId));
    if (loanIds.length !== payments.length) {
      throw new Error("One payment per loan");
    }
    const rounded: LoanPaymentInput[] = [];
    for (const p of payments) {
      const loan = state.loans.find((l) => l.id === p.loanId);
      if (!loan) {
        throw new Error("Loan not found");
      }
      assertDepositAccount(p.accountId);
      const amount = round(p.amount, 2);
      if (amount < 0.01) {
        throw new Error("Payment must be at least 0.01");
      }
      const candidate = summarizeLoan({
        loan,
        payments: [...paymentsOf(p.loanId), { amount, createdAt: p.paidAt }],
        today,
      });
      if (!candidate.isValid) {
        throw new Error("Payment exceeds what's owed");
      }
      rounded.push({ ...p, amount });
    }
    const roundedExcess = excess && { ...excess, amount: round(excess.amount, 2) };
    if (roundedExcess && roundedExcess.amount < 0.01) {
      throw new Error("Excess must be at least 0.01");
    }
    await insertPayments(rounded, roundedExcess);
    await accounts.reload();
  });

  const updatePayment = useMemoizedFn(async (txnId: string, p: LoanPaymentInput) => {
    const loan = state.loans.find((l) => l.id === p.loanId);
    const existing = paymentsOf(p.loanId).find((t) => t.id === txnId);
    if (!loan || !existing) {
      throw new Error("Payment not found");
    }
    if (p.accountId !== existing.accountId) {
      assertDepositAccount(p.accountId);
    }
    const amount = round(p.amount, 2);
    const candidate = summarizeLoan({
      loan,
      payments: paymentsOf(p.loanId).map((t) => (t.id === txnId ? { ...t, amount, createdAt: p.paidAt } : t)),
      today,
    });
    if (!candidate.isValid) {
      throw new Error("Payment exceeds what's owed");
    }
    // A smaller repayment, or one moved to another account, lowers the account it was paid into.
    const error = accounts.overdraftError([{ accountId: p.accountId, amount }], (t) => t.id === txnId);
    if (error) {
      throw error;
    }
    await updateLoanPayment(txnId, { accountId: p.accountId, amount, paidAt: p.paidAt });
    await accounts.reload();
  });

  const deletePayment = useMemoizedFn(async (txnId: string) => {
    const error = accounts.overdraftError([], (t) => t.id === txnId);
    if (error) {
      throw error;
    }
    await removeTransaction(txnId);
    await accounts.reload();
  });

  const value = useMemo(
    () => ({
      loans: state.loans,
      isLoading: state.isLoading,
      summaries,
      paymentsOf,
      borrowerOf,
      addLoan,
      updateLoan,
      deleteLoan,
      recordPayments,
      updatePayment,
      deletePayment,
      reload,
    }),
    [state, summaries, paymentsOf, borrowerOf]
  );

  return <LoanContext.Provider value={value}>{children}</LoanContext.Provider>;
}

export function useLoans() {
  const ctx = useContext(LoanContext);
  if (!ctx) {
    throw new Error("useLoans must be used within LoanProvider");
  }
  return ctx;
}
