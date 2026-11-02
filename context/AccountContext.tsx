import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";
import dayjs from "dayjs";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import { round } from "@/utils/round";
import { saveAccountLogo } from "@/utils/accountLogo/saveAccountLogo";
import { deleteAccountLogo } from "@/utils/accountLogo/deleteAccountLogo";
import type { Account, AccountInput, AccountTransaction, CardBill, CardBillOverride, IncomeInput, InterestEstimate, TransferInput } from "@/types";
import {
  getAll as getAllAccounts,
  getById as getAccountById,
  insert as insertAccount,
  remove as removeAccount,
  setArchivedAt,
  update as updateAccountRow,
} from "@/db/accounts";
import {
  creditInterest,
  emptyTxnFields,
  getAll as getAllTransactions,
  insert as insertTransaction,
  insertMany as insertTransactions,
  remove as removeTransaction,
  removeTransfer,
  replacePayment,
  replaceTransfer,
  updateIncome as updateIncomeRow,
} from "@/db/accountTransactions";
import {
  clearAmount as clearCardBillAmount,
  getAll as getAllCardBills,
  setAmount as setCardBillAmount,
} from "@/db/cardBills";
import { touchCategory } from "@/db/categories";
import { accrueInterest, PERIODS_PER_YEAR } from "@/utils/interest";
import { computeBill, unsettledDebitIds } from "@/utils/cardBills";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { TRANSFER_CATEGORY } from "@/constants/categories";
import { findOverdraft, type TBalanceChange } from "@/utils/accounts/findOverdraft";
import { OverdraftError } from "@/utils/accounts/OverdraftError";

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
  // Accounts that can take new money: everything except archived ones. Pickers list these.
  activeAccounts: Account[];
  transactions: AccountTransaction[];
  billOverrides: CardBillOverride[];
  isLoading: boolean;
  getBalance: (accountId: string) => number;
  overdraftError: (
    changes: TBalanceChange[],
    isReplaced?: (transaction: AccountTransaction) => boolean
  ) => OverdraftError | undefined;
  netWorth: { assets: number; owed: number; net: number };
  interestEstimate: (account: Account) => InterestEstimate | null;
  addAccount: (input: AccountInput, openingBalance: number) => Promise<Account>;
  updateAccount: (id: string, input: AccountInput) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  archiveAccount: (id: string) => Promise<void>;
  unarchiveAccount: (id: string) => Promise<void>;
  adjustBalance: (id: string, target: number) => Promise<void>;
  addIncome: (input: IncomeInput) => Promise<void>;
  updateIncome: (id: string, input: IncomeInput) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  transfer: (input: TransferInput) => Promise<void>;
  // Rewrites an existing transfer (all its rows) from the edited input, keeping its id.
  updateTransfer: (transferId: string, input: TransferInput) => Promise<void>;
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

export function isPaymentFor(expenseId: string, cycleYear: number | null, cycleMonth: number | null) {
  return (t: AccountTransaction) =>
    t.kind === "payment" && t.expenseId === expenseId && t.cycleYear === cycleYear && t.cycleMonth === cycleMonth;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { accounts: [], transactions: [], billOverrides: [], isLoading: true });
  const isRunningInterest = useRef(false);

  const reload = useMemoizedFn(async () => {
    const [accounts, transactions, billOverrides] = await Promise.all([
      getAllAccounts(),
      getAllTransactions(),
      getAllCardBills(),
    ]);
    dispatch({ type: "LOAD", payload: { accounts, transactions, billOverrides } });
  });

  const runInterest = useMemoizedFn(async () => {
    if (isRunningInterest.current) {
      return;
    }
    isRunningInterest.current = true;
    try {
      const [accounts, transactions] = await Promise.all([getAllAccounts(), getAllTransactions()]);
      const today = dayjs().format("YYYY-MM-DD");
      let hasCredited = false;
      for (const account of accounts) {
        if (account.type !== "debit" || account.archivedAt || !account.interestRate || account.interestRate <= 0 || !account.interestPeriod) {
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
        await creditInterest(account.id, result.gross, result.tax, result.through);
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
        getAllAccounts(),
        getAllTransactions(),
        getAllCardBills(),
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

  const overdraftError = useMemoizedFn(
    (changes: TBalanceChange[], isReplaced?: (transaction: AccountTransaction) => boolean) => {
      const overdraft = findOverdraft({ accounts: state.accounts, transactions: state.transactions, changes, isReplaced });
      return overdraft && new OverdraftError(overdraft);
    }
  );

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
    if (account.type !== "debit" || account.archivedAt || !account.interestRate || !period || balance <= 0) {
      return null;
    }
    const amount = round(((balance * account.interestRate) / 100 / PERIODS_PER_YEAR[period]) * (1 - (account.taxRate ?? 0) / 100), 2);
    return amount > 0 ? { amount, period } : null;
  });

  const addAccount = useMemoizedFn(async (input: AccountInput, openingBalance: number) => {
    const logoUri = input.logoUri ? await saveAccountLogo(input.logoUri) : null;
    const account = await insertAccount({ ...input, logoUri });
    dispatch({ type: "ADD_ACCOUNT", payload: account });
    const amount = round(openingBalance, 2);
    if (amount !== 0) {
      const txn = await insertTransaction({
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
    await updateAccountRow(id, { ...input, logoUri });
    if (previousLogo && previousLogo !== logoUri) {
      await deleteAccountLogo(previousLogo);
    }
    const accounts = await getAllAccounts();
    dispatch({ type: "SET_ACCOUNTS", payload: accounts });
  });

  const setArchived = useMemoizedFn(async (id: string, archivedAt: string | null) => {
    await setArchivedAt(id, archivedAt);
    dispatch({ type: "SET_ACCOUNTS", payload: await getAllAccounts() });
  });

  // Archiving keeps an account's history and balance (still in net worth) but takes it out of pickers, bills and
  // interest, so it's the safe way to retire an account. Cash always stays.
  const archiveAccount = useMemoizedFn(async (id: string) => {
    if (id === CASH_ACCOUNT_ID) {
      throw new Error("Cash can't be archived");
    }
    await setArchived(id, new Date().toISOString());
  });

  const unarchiveAccount = useMemoizedFn(async (id: string) => {
    await setArchived(id, null);
  });

  const activeAccounts = useMemo(() => state.accounts.filter((a) => !a.archivedAt), [state.accounts]);

  const deleteAccount = useMemoizedFn(async (id: string) => {
    const logoUri = state.accounts.find((a) => a.id === id)?.logoUri;
    await removeAccount(id);
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
    const txn = await insertTransaction({
      ...emptyTxnFields(),
      accountId: id,
      kind: "adjust",
      amount,
      createdAt: new Date().toISOString(),
    });
    dispatch({ type: "ADD_TRANSACTIONS", payload: [txn] });
  });

  const addIncome = useMemoizedFn(async (input: IncomeInput) => {
    const account = state.accounts.find((a) => a.id === input.accountId);
    if (account?.type === "credit") {
      throw new Error("Income can't be deposited to a credit card");
    }
    if (account?.archivedAt) {
      throw new Error("Income can't be deposited to an archived account");
    }
    const txn = await insertTransaction({
      ...emptyTxnFields(),
      accountId: input.accountId,
      kind: "income",
      amount: round(input.amount, 2),
      category: input.category,
      note: input.note,
      createdAt: input.receivedAt,
    });
    dispatch({ type: "ADD_TRANSACTIONS", payload: [txn] });
    await touchCategory({ name: input.category, kind: "income" });
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
    const error = overdraftError([{ accountId: input.accountId, amount }], (t) => t.id === id);
    if (error) {
      throw error;
    }
    await updateIncomeRow(id, { ...input, amount });
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
    await touchCategory({ name: input.category, kind: "income" });
  });

  const deleteIncome = useMemoizedFn(async (id: string) => {
    const error = overdraftError([], (t) => t.id === id);
    if (error) {
      throw error;
    }
    await removeTransaction(id);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.id === id });
  });

  const buildTransferRows = (
    { fromId, toId, amount, fee, income, incomeAccountId, note, createdAt: when }: TransferInput,
    transferId: string
  ): Omit<AccountTransaction, "id">[] => {
    const from = state.accounts.find((a) => a.id === fromId);
    const to = state.accounts.find((a) => a.id === toId);
    if (!from || !to) {
      throw new Error("Transfer account not found");
    }
    if (from.type === "credit") {
      throw new Error("Cannot transfer from a credit account");
    }
    if (from.archivedAt || to.archivedAt) {
      throw new Error("Archived accounts can't send or receive transfers");
    }
    const value = round(amount, 2);
    const feeValue = round(fee, 2);
    const incomeValue = round(income, 2);
    if (!(value > 0) || feeValue < 0 || incomeValue < 0 || fromId === toId) {
      throw new Error("Invalid transfer");
    }
    const incomeAccount = state.accounts.find((a) => a.id === incomeAccountId);
    // Card-bill payments aren't TransferEntries, so income on one would never surface in Activity.
    if (incomeValue > 0 && (incomeAccount == null || incomeAccount.archivedAt || incomeAccount.type === "credit" || to.type === "credit")) {
      throw new Error("Invalid transfer income");
    }
    const createdAt = when ?? new Date().toISOString();
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
    if (incomeValue > 0) {
      rows.push({
        ...emptyTxnFields(),
        accountId: incomeAccountId,
        kind: "income",
        amount: incomeValue,
        transferId,
        category: TRANSFER_CATEGORY,
        note: note ?? `Earned on transfer ${from.name} → ${to.name}`,
        createdAt,
      });
    }
    return rows;
  };

  const transfer = useMemoizedFn(async (input: TransferInput) => {
    const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const rows = buildTransferRows(input, transferId);
    const error = overdraftError(rows);
    if (error) {
      throw error;
    }
    const txns = await insertTransactions(rows);
    dispatch({ type: "ADD_TRANSACTIONS", payload: txns });
  });

  const updateTransfer = useMemoizedFn(async (transferId: string, input: TransferInput) => {
    const rows = buildTransferRows(input, transferId);
    const error = overdraftError(rows, (t) => t.transferId === transferId);
    if (error) {
      throw error;
    }
    const txns = await replaceTransfer(transferId, rows);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.transferId === transferId });
    dispatch({ type: "ADD_TRANSACTIONS", payload: txns });
  });

  const deleteTransfer = useMemoizedFn(async (transferId: string) => {
    const error = overdraftError([], (t) => t.transferId === transferId);
    if (error) {
      throw error;
    }
    await removeTransfer(transferId);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: (t) => t.transferId === transferId });
  });

  const syncPayment = useMemoizedFn(async (p: PaymentSync) => {
    let account = state.accounts.find((a) => a.id === p.accountId);
    if (!account && state.isLoading && p.accountId != null) {
      account = await getAccountById(p.accountId);
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
    const error = txn && overdraftError([txn], isPaymentFor(p.expenseId, p.cycleYear, p.cycleMonth));
    if (error) {
      throw error;
    }
    const inserted = await replacePayment(p.expenseId, p.cycleYear, p.cycleMonth, txn);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: isPaymentFor(p.expenseId, p.cycleYear, p.cycleMonth) });
    if (inserted) {
      dispatch({ type: "ADD_TRANSACTIONS", payload: [inserted] });
    }
  });

  const removePayment = useMemoizedFn(async (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => {
    await replacePayment(expenseId, cycleYear, cycleMonth, null);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: isPaymentFor(expenseId, cycleYear, cycleMonth) });
  });

  const setBillAmount = useMemoizedFn(async (accountId: string, year: number, month: number, amount: number | null) => {
    if (amount == null) {
      await clearCardBillAmount(accountId, year, month);
    } else {
      await setCardBillAmount(accountId, year, month, round(amount, 2));
    }
    const billOverrides = await getAllCardBills();
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
        // An archived card has no bills after it was archived; earlier ones stay part of past months.
        if (account.archivedAt && dayjs(bill.dueDate).isAfter(dayjs(account.archivedAt), "day")) {
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
      activeAccounts,
      transactions: state.transactions,
      billOverrides: state.billOverrides,
      isLoading: state.isLoading,
      getBalance,
      overdraftError,
      netWorth,
      interestEstimate,
      addAccount,
      updateAccount,
      deleteAccount,
      archiveAccount,
      unarchiveAccount,
      adjustBalance,
      addIncome,
      updateIncome,
      deleteIncome,
      transfer,
      updateTransfer,
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
    [state, activeAccounts, netWorth, getCardBills, isCharged, isCardAccount, isCardCharge]
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
