import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";
import dayjs from "dayjs";
import useAsyncEffect from "ahooks/es/useAsyncEffect";
import useMemoizedFn from "ahooks/es/useMemoizedFn";
import round from "lodash/round";
import { saveAccountLogo } from "@/utils/accountLogo/saveAccountLogo";
import { deleteAccountLogo } from "@/utils/accountLogo/deleteAccountLogo";
import type { Account, AccountInput, AccountTransaction, CardBill, CardBillOverride, IncomeInput, InterestEstimate } from "@/types";
import * as accountsDB from "@/db/accounts";
import * as transactionsDB from "@/db/accountTransactions";
import * as cardBillsDB from "@/db/cardBills";
import { touchCategory } from "@/db/categories";
import { accrueInterest, PERIODS_PER_YEAR } from "@/utils/interest";
import { computeBill, unsettledDebitIds } from "@/utils/cardBills";

interface State {
  accounts: Account[];
  transactions: AccountTransaction[];
  billOverrides: CardBillOverride[];
  isLoading: boolean;
}

type Action =
  | { type: "LOAD"; payload: { accounts: Account[]; transactions: AccountTransaction[]; billOverrides: CardBillOverride[] } }
  | { type: "SET_BILL_OVERRIDES"; payload: CardBillOverride[] }
  | { type: "SET_ACCOUNTS"; payload: Account[] }
  | { type: "ADD_ACCOUNT"; payload: Account }
  | { type: "ADD_TRANSACTIONS"; payload: AccountTransaction[] }
  | { type: "REMOVE_TRANSACTIONS"; payload: (t: AccountTransaction) => boolean };

function isBillCard(account: Account) {
  return account.type === "credit" && account.statementDay != null && account.dueDay != null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { ...action.payload, isLoading: false };
    case "SET_BILL_OVERRIDES":
      return { ...state, billOverrides: action.payload };
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
  billOverrides: CardBillOverride[];
  isLoading: boolean;
  getBalance: (accountId: string) => number;
  netWorth: { assets: number; owed: number; net: number };
  interestEstimate: (account: Account) => InterestEstimate | null;
  addAccount: (input: AccountInput, openingBalance: number) => Promise<Account>;
  updateAccount: (id: string, input: AccountInput) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  adjustBalance: (id: string, target: number) => Promise<void>;
  addIncome: (input: IncomeInput) => Promise<void>;
  updateIncome: (id: string, input: IncomeInput) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  transfer: (fromId: string, toId: string, amount: number, note?: string, fee?: number) => Promise<void>;
  deleteTransfer: (transferId: string) => Promise<void>;
  syncPayment: (p: PaymentSync) => Promise<void>;
  removePayment: (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => Promise<void>;
  getCardBills: (year: number, month: number) => CardBill[];
  setBillAmount: (accountId: string, year: number, month: number, amount: number | null) => Promise<void>;
  isCharged: (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => boolean;
  isCardAccount: (accountId: string | null | undefined) => boolean;
  isCardCharge: (
    expenseId: string,
    cycleYear: number | null,
    cycleMonth: number | null,
    fallbackAccountId: string | null | undefined
  ) => boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function sumAmounts(transactions: AccountTransaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function isPaymentFor(expenseId: string, cycleYear: number | null, cycleMonth: number | null) {
  return (t: AccountTransaction) =>
    t.kind === "payment" && t.expenseId === expenseId && t.cycleYear === cycleYear && t.cycleMonth === cycleMonth;
}

function emptyTxnFields(): Pick<AccountTransaction, "expenseId" | "cycleYear" | "cycleMonth" | "transferId" | "category"> {
  return { expenseId: null, cycleYear: null, cycleMonth: null, transferId: null, category: null };
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { accounts: [], transactions: [], billOverrides: [], isLoading: true });
  const isRunningInterest = useRef(false);

  const reload = useMemoizedFn(async () => {
    const [accounts, transactions, billOverrides] = await Promise.all([
      accountsDB.getAll(),
      transactionsDB.getAll(),
      cardBillsDB.getAll(),
    ]);
    dispatch({ type: "LOAD", payload: { accounts, transactions, billOverrides } });
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

  const refresh = useMemoizedFn(async () => {
    await runInterest();
    await reload();
  });

  useAsyncEffect(async function* () {
    try {
      const [accounts, transactions, billOverrides] = await Promise.all([
        accountsDB.getAll(),
        transactionsDB.getAll(),
        cardBillsDB.getAll(),
      ]);
      yield;
      dispatch({ type: "LOAD", payload: { accounts, transactions, billOverrides } });
    } catch (e) {
      console.error(e);
      yield;
      dispatch({ type: "LOAD", payload: { accounts: [], transactions: [], billOverrides: [] } });
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

  const interestEstimate = useMemoizedFn((account: Account) => {
    const balance = getBalance(account.id);
    const period = account.interestPeriod;
    if (account.type !== "debit" || !account.interestRate || !period || balance <= 0) {
      return null;
    }
    const amount = round(((balance * account.interestRate) / 100 / PERIODS_PER_YEAR[period]) * (1 - (account.taxRate ?? 0) / 100), 2);
    return amount > 0 ? { amount, period } : null;
  });

  const addAccount = useMemoizedFn(async (input: AccountInput, openingBalance: number) => {
    const logoUri = input.logoUri ? await saveAccountLogo(input.logoUri) : null;
    const account = await accountsDB.insert({ ...input, logoUri });
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
    const previousLogo = state.accounts.find((a) => a.id === id)?.logoUri;
    const logoUri =
      input.logoUri != null && input.logoUri !== previousLogo ? await saveAccountLogo(input.logoUri) : input.logoUri;
    await accountsDB.update(id, { ...input, logoUri });
    if (previousLogo && previousLogo !== logoUri) {
      await deleteAccountLogo(previousLogo);
    }
    const accounts = await accountsDB.getAll();
    dispatch({ type: "SET_ACCOUNTS", payload: accounts });
  });

  const deleteAccount = useMemoizedFn(async (id: string) => {
    const logoUri = state.accounts.find((a) => a.id === id)?.logoUri;
    await accountsDB.remove(id);
    if (logoUri) {
      await deleteAccountLogo(logoUri);
    }
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

  const addIncome = useMemoizedFn(async (input: IncomeInput) => {
    if (state.accounts.find((a) => a.id === input.accountId)?.type === "credit") {
      throw new Error("Income can't be deposited to a credit card");
    }
    const txn = await transactionsDB.insert({
      ...emptyTxnFields(),
      accountId: input.accountId,
      kind: "income",
      amount: round(input.amount, 2),
      category: input.category,
      note: input.note,
      createdAt: input.receivedAt,
    });
    dispatch({ type: "ADD_TRANSACTIONS", payload: [txn] });
    await touchCategory(input.category, undefined, "income");
  });

  const updateIncome = useMemoizedFn(async (id: string, input: IncomeInput) => {
    if (state.accounts.find((a) => a.id === input.accountId)?.type === "credit") {
      throw new Error("Income can't be deposited to a credit card");
    }
    const existing = state.transactions.find((t) => t.id === id && t.kind === "income");
    if (!existing) {
      throw new Error("Income not found");
    }
    const amount = round(input.amount, 2);
    await transactionsDB.updateIncome(id, { ...input, amount });
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.id === id });
    dispatch({
      type: "ADD_TRANSACTIONS",
      payload: [
        {
          ...existing,
          accountId: input.accountId,
          amount,
          category: input.category,
          note: input.note,
          createdAt: input.receivedAt,
        },
      ],
    });
    await touchCategory(input.category, undefined, "income");
  });

  const deleteIncome = useMemoizedFn(async (id: string) => {
    await transactionsDB.remove(id);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.id === id });
  });

  const transfer = useMemoizedFn(async (fromId: string, toId: string, amount: number, note?: string, fee = 0) => {
    const from = state.accounts.find((a) => a.id === fromId);
    const to = state.accounts.find((a) => a.id === toId);
    if (!from || !to) {
      throw new Error("Transfer account not found");
    }
    if (from.type === "credit") {
      throw new Error("Cannot transfer from a credit account");
    }
    const value = round(amount, 2);
    const feeValue = round(fee, 2);
    if (!(value > 0) || feeValue < 0 || fromId === toId) {
      throw new Error("Invalid transfer");
    }
    const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const createdAt = new Date().toISOString();
    const rows: Omit<AccountTransaction, "id">[] = [
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
    ];
    if (feeValue > 0) {
      rows.push({
        ...emptyTxnFields(),
        accountId: fromId,
        kind: "fee",
        amount: -feeValue,
        transferId,
        note: `Fee for transfer to ${to.name}`,
        createdAt,
      });
    }
    const txns = await transactionsDB.insertMany(rows);
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

  const setBillAmount = useMemoizedFn(async (accountId: string, year: number, month: number, amount: number | null) => {
    if (amount == null) {
      await cardBillsDB.clearAmount(accountId, year, month);
    } else {
      await cardBillsDB.setAmount(accountId, year, month, round(amount, 2));
    }
    const billOverrides = await cardBillsDB.getAll();
    dispatch({ type: "SET_BILL_OVERRIDES", payload: billOverrides });
  });

  const getCardBills = useCallback(
    (year: number, month: number): CardBill[] => {
      const now = new Date();
      const bills: CardBill[] = [];
      for (const account of state.accounts) {
        const { statementDay, dueDay } = account;
        if (account.type !== "credit" || statementDay == null || dueDay == null) {
          continue;
        }
        const txns = state.transactions.filter((t) => t.accountId === account.id);
        const override =
          state.billOverrides.find((o) => o.accountId === account.id && o.year === year && o.month === month)?.amount ??
          null;
        const bill = computeBill({ txns, statementDay, dueDay, year, month, override, now });
        if (dayjs(bill.cutoff).isBefore(dayjs(account.createdAt).startOf("month"))) {
          continue;
        }
        bills.push({ ...bill, account, year, month });
      }
      return bills;
    },
    [state.accounts, state.transactions, state.billOverrides]
  );

  const unsettledByCard = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const account of state.accounts) {
      if (isBillCard(account)) {
        map.set(account.id, unsettledDebitIds(state.transactions.filter((t) => t.accountId === account.id)));
      }
    }
    return map;
  }, [state.accounts, state.transactions]);

  const isCharged = useCallback(
    (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => {
      const payment = state.transactions.find(isPaymentFor(expenseId, cycleYear, cycleMonth));
      if (!payment) {
        return false;
      }
      return unsettledByCard.get(payment.accountId)?.has(payment.id) ?? false;
    },
    [state.transactions, unsettledByCard]
  );

  const isCardAccount = useCallback(
    (accountId: string | null | undefined) =>
      accountId != null && state.accounts.some((a) => a.id === accountId && isBillCard(a)),
    [state.accounts]
  );

  const isCardCharge = useCallback(
    (
      expenseId: string,
      cycleYear: number | null,
      cycleMonth: number | null,
      fallbackAccountId: string | null | undefined
    ) => {
      const payment = state.transactions.find(isPaymentFor(expenseId, cycleYear, cycleMonth));
      return isCardAccount(payment?.accountId ?? fallbackAccountId);
    },
    [state.transactions, isCardAccount]
  );

  const value = useMemo(
    () => ({
      accounts: state.accounts,
      transactions: state.transactions,
      billOverrides: state.billOverrides,
      isLoading: state.isLoading,
      getBalance,
      netWorth,
      interestEstimate,
      addAccount,
      updateAccount,
      deleteAccount,
      adjustBalance,
      addIncome,
      updateIncome,
      deleteIncome,
      transfer,
      deleteTransfer,
      syncPayment,
      removePayment,
      getCardBills,
      setBillAmount,
      isCharged,
      isCardAccount,
      isCardCharge,
      reload,
      refresh,
    }),
    [state, netWorth, getCardBills, isCharged, isCardAccount, isCardCharge]
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
