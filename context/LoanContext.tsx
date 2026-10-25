import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import dayjs from "dayjs";
import useAsyncEffect from "ahooks/es/useAsyncEffect";
import useMemoizedFn from "ahooks/es/useMemoizedFn";
import round from "lodash/round";
import {
  getAll as getAllLoans,
  insert as insertLoan,
  update as updateLoanRow,
  remove as removeLoan,
  insertPayment,
} from "@/db/loans";
import { remove as removeTransaction } from "@/db/accountTransactions";
import { useAccounts } from "@/context/AccountContext";
import { summarizeLoan, type TLoanSummary } from "@/utils/loans/summarizeLoan";
import { useToday } from "@/utils/useToday";
import type { AccountTransaction, Loan, LoanInput, LoanPaymentInput } from "@/types";

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
  addLoan: (input: LoanInput) => Promise<void>;
  updateLoan: (id: string, input: LoanInput) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  recordPayment: (p: LoanPaymentInput) => Promise<void>;
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
  };

  const addLoan = useMemoizedFn(async (input: LoanInput) => {
    assertDepositAccount(input.accountId);
    const loan = await insertLoan({ ...input, principal: round(input.principal, 2) });
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
    await updateLoanRow(id, next);
    dispatch({ type: "UPDATE_LOAN", payload: { ...existing, ...next } });
    await accounts.reload();
  });

  const deleteLoan = useMemoizedFn(async (id: string) => {
    await removeLoan(id);
    dispatch({ type: "REMOVE_LOAN", payload: id });
    await accounts.reload();
  });

  const recordPayment = useMemoizedFn(async (p: LoanPaymentInput) => {
    const loan = state.loans.find((l) => l.id === p.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }
    assertDepositAccount(p.accountId);
    const amount = round(p.amount, 2);
    const candidate = summarizeLoan({
      loan,
      payments: [...paymentsOf(p.loanId), { amount, createdAt: p.paidAt }],
      today,
    });
    if (!candidate.isValid) {
      throw new Error("Payment exceeds what's owed");
    }
    await insertPayment({ ...p, amount });
    await accounts.reload();
  });

  const deletePayment = useMemoizedFn(async (txnId: string) => {
    await removeTransaction(txnId);
    await accounts.reload();
  });

  const value = useMemo(
    () => ({
      loans: state.loans,
      isLoading: state.isLoading,
      summaries,
      paymentsOf,
      addLoan,
      updateLoan,
      deleteLoan,
      recordPayment,
      deletePayment,
      reload,
    }),
    [state, summaries, paymentsOf]
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
