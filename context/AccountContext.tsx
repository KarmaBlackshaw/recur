import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";
import dayjs from "dayjs";
import useAsyncEffect from "ahooks/es/useAsyncEffect";
import useMemoizedFn from "ahooks/es/useMemoizedFn";
import round from "lodash/round";
import type { Account, AccountInput, AccountTransaction } from "@/types";
import * as accountsDB from "@/db/accounts";
import * as transactionsDB from "@/db/accountTransactions";
import { accrueInterest } from "@/utils/interest";

interface State {
  accounts: Account[];
  transactions: AccountTransaction[];
  isLoading: boolean;
}

type Action =
  | { type: "LOAD"; payload: { accounts: Account[]; transactions: AccountTransaction[] } }
  | { type: "SET_ACCOUNTS"; payload: Account[] }
  | { type: "ADD_ACCOUNT"; payload: Account }
  | { type: "ADD_TRANSACTIONS"; payload: AccountTransaction[] }
  | { type: "REMOVE_TRANSACTIONS"; payload: (t: AccountTransaction) => boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { ...action.payload, isLoading: false };
    case "SET_ACCOUNTS":
      return { ...state, accounts: action.payload };
    case "ADD_ACCOUNT":
      if (state.accounts.some((a) => a.id === action.payload.id)) {
        return state;
      }
      return { ...state, accounts: [...state.accounts, action.payload] };
    case "ADD_TRANSACTIONS": {
      const ids = new Set(state.transactions.map((t) => t.id));
      return { ...state, transactions: [...state.transactions, ...action.payload.filter((t) => !ids.has(t.id))] };
    }
    case "REMOVE_TRANSACTIONS":
      return { ...state, transactions: state.transactions.filter((t) => !action.payload(t)) };
    default:
      return state;
  }
}

export interface PaymentSync {
  expenseId: string;
  accountId: string | null | undefined;
  cycleYear: number | null;
  cycleMonth: number | null;
  amount: number | null;
  note: string;
  createdAt?: string;
}

interface AccountContextValue {
  accounts: Account[];
  transactions: AccountTransaction[];
  isLoading: boolean;
  getBalance: (accountId: string) => number;
  netWorth: { assets: number; owed: number; net: number };
  monthlyInterestEstimate: (account: Account) => number;
  addAccount: (input: AccountInput, openingBalance: number) => Promise<Account>;
  updateAccount: (id: string, input: AccountInput) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  adjustBalance: (id: string, target: number) => Promise<void>;
  transfer: (fromId: string, toId: string, amount: number, note?: string) => Promise<void>;
  deleteTransfer: (transferId: string) => Promise<void>;
  syncPayment: (p: PaymentSync) => Promise<void>;
  removePayment: (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => Promise<void>;
  reload: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function sumAmounts(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function isPaymentFor(expenseId: string, cycleYear: number | null, cycleMonth: number | null) {
  return (t: AccountTransaction) =>
    t.kind === "payment" && t.expenseId === expenseId && t.cycleYear === cycleYear && t.cycleMonth === cycleMonth;
}

function emptyTxnFields(): Pick<AccountTransaction, "expenseId" | "cycleYear" | "cycleMonth" | "transferId"> {
  return { expenseId: null, cycleYear: null, cycleMonth: null, transferId: null };
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { accounts: [], transactions: [], isLoading: true });
  const isRunningInterest = useRef(false);

  const reload = useMemoizedFn(async () => {
    const [accounts, transactions] = await Promise.all([accountsDB.getAll(), transactionsDB.getAll()]);
    dispatch({ type: "LOAD", payload: { accounts, transactions } });
  });

  const runInterest = useMemoizedFn(async () => {
    if (isRunningInterest.current) {
      return;
    }
    isRunningInterest.current = true;
    try {
      const [accounts, transactions] = await Promise.all([accountsDB.getAll(), transactionsDB.getAll()]);
      const today = dayjs().format("YYYY-MM-DD");
      let hasCredited = false;
      for (const account of accounts) {
        if (account.type !== "debit" || !account.interestRate || account.interestRate <= 0 || !account.interestPeriod) {
          continue;
        }
        const own = transactions.filter((t) => t.accountId === account.id);
        const result = accrueInterest({
          rate: account.interestRate,
          period: account.interestPeriod,
          taxRate: account.taxRate ?? 0,
          from: account.interestAccruedThrough ?? dayjs(account.createdAt).format("YYYY-MM-DD"),
          today,
          balanceAt: (end) => {
            const limit = dayjs(end).endOf("day");
            return sumAmounts(own.filter((t) => !dayjs(t.createdAt).isAfter(limit)));
          },
        });
        if (!result) {
          continue;
        }
        await transactionsDB.creditInterest(account.id, result.gross, result.tax, result.through);
        hasCredited = true;
      }
      if (hasCredited) {
        await reload();
      }
    } catch (e) {
      console.error("Interest accrual failed", e);
    } finally {
      isRunningInterest.current = false;
    }
  });

  useAsyncEffect(async function* () {
    try {
      const [accounts, transactions] = await Promise.all([accountsDB.getAll(), transactionsDB.getAll()]);
      yield;
      dispatch({ type: "LOAD", payload: { accounts, transactions } });
    } catch (e) {
      console.error(e);
      yield;
      dispatch({ type: "LOAD", payload: { accounts: [], transactions: [] } });
    }
    await runInterest();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        runInterest();
      }
    });
    return () => subscription.remove();
  }, [runInterest]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of state.transactions) {
      map[t.accountId] = (map[t.accountId] ?? 0) + t.amount;
    }
    return map;
  }, [state.transactions]);

  const getBalance = useMemoizedFn((accountId: string) => round(balances[accountId] ?? 0, 2));

  const netWorth = useMemo(() => {
    let assets = 0;
    let owed = 0;
    for (const account of state.accounts) {
      const balance = balances[account.id] ?? 0;
      if (account.type === "credit") {
        owed += balance;
      } else {
        assets += balance;
      }
    }
    return { assets: round(assets, 2), owed: round(owed, 2), net: round(assets - owed, 2) };
  }, [state.accounts, balances]);

  const monthlyInterestEstimate = useMemoizedFn((account: Account) => {
    const balance = getBalance(account.id);
    if (account.type !== "debit" || !account.interestRate || balance <= 0) {
      return 0;
    }
    return round(((balance * account.interestRate) / 100 / 12) * (1 - (account.taxRate ?? 0) / 100), 2);
  });

  const addAccount = useMemoizedFn(async (input: AccountInput, openingBalance: number) => {
    const account = await accountsDB.insert(input);
    dispatch({ type: "ADD_ACCOUNT", payload: account });
    const amount = round(openingBalance, 2);
    if (amount !== 0) {
      const txn = await transactionsDB.insert({
        ...emptyTxnFields(),
        accountId: account.id,
        kind: "adjust",
        amount,
        note: "Opening balance",
        createdAt: account.createdAt,
      });
      dispatch({ type: "ADD_TRANSACTIONS", payload: [txn] });
    }
    return account;
  });

  const updateAccount = useMemoizedFn(async (id: string, input: AccountInput) => {
    await accountsDB.update(id, input);
    const accounts = await accountsDB.getAll();
    dispatch({ type: "SET_ACCOUNTS", payload: accounts });
  });

  const deleteAccount = useMemoizedFn(async (id: string) => {
    await accountsDB.remove(id);
    await reload();
  });

  const adjustBalance = useMemoizedFn(async (id: string, target: number) => {
    const amount = round(target - getBalance(id), 2);
    if (amount === 0) {
      return;
    }
    const txn = await transactionsDB.insert({
      ...emptyTxnFields(),
      accountId: id,
      kind: "adjust",
      amount,
      note: null,
      createdAt: new Date().toISOString(),
    });
    dispatch({ type: "ADD_TRANSACTIONS", payload: [txn] });
  });

  const transfer = useMemoizedFn(async (fromId: string, toId: string, amount: number, note?: string) => {
    const from = state.accounts.find((a) => a.id === fromId);
    const to = state.accounts.find((a) => a.id === toId);
    if (!from || !to) {
      throw new Error("Transfer account not found");
    }
    if (from.type === "credit") {
      throw new Error("Cannot transfer from a credit account");
    }
    const value = round(amount, 2);
    if (!(value > 0) || fromId === toId) {
      throw new Error("Invalid transfer");
    }
    const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const createdAt = new Date().toISOString();
    const txns = await transactionsDB.insertMany([
      {
        ...emptyTxnFields(),
        accountId: fromId,
        kind: "transfer",
        amount: -value,
        transferId,
        note: note ?? `Transfer to ${to.name}`,
        createdAt,
      },
      {
        ...emptyTxnFields(),
        accountId: toId,
        kind: "transfer",
        amount: to.type === "credit" ? -value : value,
        transferId,
        note: note ?? `Transfer from ${from.name}`,
        createdAt,
      },
    ]);
    dispatch({ type: "ADD_TRANSACTIONS", payload: txns });
  });

  const deleteTransfer = useMemoizedFn(async (transferId: string) => {
    await transactionsDB.removeTransfer(transferId);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.transferId === transferId });
  });

  const syncPayment = useMemoizedFn(async (p: PaymentSync) => {
    let account = state.accounts.find((a) => a.id === p.accountId);
    if (!account && state.isLoading && p.accountId != null) {
      account = await accountsDB.getById(p.accountId);
    }
    const existing = state.transactions.find(isPaymentFor(p.expenseId, p.cycleYear, p.cycleMonth));
    const txn: Omit<AccountTransaction, "id"> | null =
      account && p.amount != null
        ? {
            ...emptyTxnFields(),
            accountId: account.id,
            kind: "payment",
            amount: account.type === "credit" ? round(p.amount, 2) : -round(p.amount, 2),
            expenseId: p.expenseId,
            cycleYear: p.cycleYear,
            cycleMonth: p.cycleMonth,
            note: p.note,
            createdAt: p.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
          }
        : null;
    const inserted = await transactionsDB.replacePayment(p.expenseId, p.cycleYear, p.cycleMonth, txn);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: isPaymentFor(p.expenseId, p.cycleYear, p.cycleMonth) });
    if (inserted) {
      dispatch({ type: "ADD_TRANSACTIONS", payload: [inserted] });
    }
  });

  const removePayment = useMemoizedFn(async (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => {
    await transactionsDB.replacePayment(expenseId, cycleYear, cycleMonth, null);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: isPaymentFor(expenseId, cycleYear, cycleMonth) });
  });

  const value = useMemo(
    () => ({
      accounts: state.accounts,
      transactions: state.transactions,
      isLoading: state.isLoading,
      getBalance,
      netWorth,
      monthlyInterestEstimate,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustBalance,
      transfer,
      deleteTransfer,
      syncPayment,
      removePayment,
      reload,
    }),
    [state, netWorth]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccounts() {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccounts must be used within AccountProvider");
  }
  return ctx;
}
