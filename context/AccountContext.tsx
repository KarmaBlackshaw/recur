import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";
import dayjs from "dayjs";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import { round } from "@/utils/round";
import { sortBy } from "@/utils/collections";
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
  insertReversals,
  removePayments,
  removeReversals,
  removeTransfer,
  replacePayments as replacePaymentRows,
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
import { CASH_ACCOUNT_ID, DELETED_ACCOUNT } from "@/constants/accounts";
import { TRANSFER_CATEGORY } from "@/constants/categories";
import { findOverdraft, type TBalanceChange } from "@/utils/accounts/findOverdraft";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import { buildReversal } from "@/utils/reversals/buildReversal";
import { inEffectTransactions } from "@/utils/reversals/inEffectTransactions";
import { withReversals } from "@/utils/reversals/withReversals";

interface State {
  accounts: Account[];
  ledger: AccountTransaction[];
  billOverrides: CardBillOverride[];
  isLoading: boolean;
}

type Action =
  | { type: "LOAD"; payload: { accounts: Account[]; ledger: AccountTransaction[]; billOverrides: CardBillOverride[] } }
  | { type: "SET_BILL_OVERRIDES"; payload: CardBillOverride[] }
  | { type: "SET_ACCOUNTS"; payload: Account[] }
  | { type: "ADD_ACCOUNT"; payload: Account }
  | { type: "ADD_TRANSACTIONS"; payload: AccountTransaction[] }
  | { type: "REMOVE_TRANSACTIONS"; payload: string[] };

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
      const ids = new Set(state.ledger.map((t) => t.id));
      return { ...state, ledger: [...state.ledger, ...action.payload.filter((t) => !ids.has(t.id))] };
    }
    case "REMOVE_TRANSACTIONS": {
      const ids = new Set(action.payload);
      return { ...state, ledger: state.ledger.filter((t) => !ids.has(t.id)) };
    }
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

export interface PaymentInput {
  accountId: string | null | undefined;
  amount: number | null;
  note: string;
  createdAt: string;
}

interface AccountContextValue {
  accounts: Account[];
  // Accounts that can take new money: everything except archived ones. Pickers list these.
  activeAccounts: Account[];
  // Names any account, archived included. An id that's no longer there reads "Deleted account".
  nameOf: (id: string) => string;
  transactions: AccountTransaction[];
  ledger: AccountTransaction[];
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
  replacePayments: (
    expenseId: string,
    cycleYear: number | null,
    cycleMonth: number | null,
    payments: PaymentInput[]
  ) => Promise<void>;
  reverseTransactions: (ids: string[]) => Promise<AccountTransaction[]>;
  undoReversals: (reversalIds: string[]) => Promise<void>;
  deletePayments: (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => Promise<void>;
  getPayments: (expenseId: string, cycleYear: number | null, cycleMonth: number | null) => AccountTransaction[];
  isTxnCharged: (txn: AccountTransaction) => boolean;
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

function paymentKey(expenseId: string, cycleYear: number | null, cycleMonth: number | null) {
  return JSON.stringify([expenseId, cycleYear, cycleMonth]);
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { accounts: [], ledger: [], billOverrides: [], isLoading: true });
  const isRunningInterest = useRef(false);

  const transactions = useMemo(() => inEffectTransactions(state.ledger), [state.ledger]);
  const paymentsByCycle = useMemo(() => {
    const payments = new Map<string, AccountTransaction[]>();
    for (const transaction of transactions) {
      if (transaction.kind !== "payment" || transaction.expenseId == null) {
        continue;
      }
      const key = paymentKey(transaction.expenseId, transaction.cycleYear, transaction.cycleMonth);
      const cyclePayments = payments.get(key);
      if (cyclePayments) {
        cyclePayments.push(transaction);
      } else {
        payments.set(key, [transaction]);
      }
    }
    for (const [key, cyclePayments] of payments) {
      payments.set(key, sortBy(cyclePayments, "createdAt"));
    }
    return payments;
  }, [transactions]);

  const reload = useMemoizedFn(async () => {
    const [accounts, ledger, billOverrides] = await Promise.all([
      getAllAccounts(),
      getAllTransactions(),
      getAllCardBills(),
    ]);
    dispatch({ type: "LOAD", payload: { accounts, ledger, billOverrides } });
  });

  const runInterest = useMemoizedFn(async () => {
    if (isRunningInterest.current) {
      return;
    }
    isRunningInterest.current = true;
    try {
      // Raw rows, reversals included: the balance history follows the reversal date.
      const [accounts, rawRows] = await Promise.all([getAllAccounts(), getAllTransactions()]);
      const today = dayjs().format("YYYY-MM-DD");
      let hasCredited = false;
      for (const account of accounts) {
        if (account.type !== "debit" || account.archivedAt || !account.interestRate || account.interestRate <= 0 || !account.interestPeriod) {
          continue;
        }
        const own = rawRows.filter((t) => t.accountId === account.id);
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
      const [accounts, ledger, billOverrides] = await Promise.all([
        getAllAccounts(),
        getAllTransactions(),
        getAllCardBills(),
      ]);
      yield;
      dispatch({ type: "LOAD", payload: { accounts, ledger, billOverrides } });
    } catch (e) {
      console.error(e);
      yield;
      dispatch({ type: "LOAD", payload: { accounts: [], ledger: [], billOverrides: [] } });
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
    for (const t of transactions) {
      map[t.accountId] = (map[t.accountId] ?? 0) + t.amount;
    }
    return map;
  }, [transactions]);

  const getBalance = useMemoizedFn((accountId: string) => round(balances[accountId] ?? 0, 2));

  const overdraftError = useMemoizedFn(
    (changes: TBalanceChange[], isReplaced?: (transaction: AccountTransaction) => boolean) => {
      const overdraft = findOverdraft({ accounts: state.accounts, transactions, changes, isReplaced });
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

  const nameById = useMemo(() => new Map(state.accounts.map((account) => [account.id, account.name])), [state.accounts]);
  const nameOf = useCallback((id: string) => nameById.get(id) ?? DELETED_ACCOUNT, [nameById]);

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
    const existing = transactions.find((t) => t.id === id && t.kind === "income");
    if (!existing) {
      throw new Error("Income not found");
    }
    const amount = round(input.amount, 2);
    const error = overdraftError([{ accountId: input.accountId, amount }], (t) => t.id === id);
    if (error) {
      throw error;
    }
    await updateIncomeRow(id, { ...input, amount });
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: [id] });
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
    const removedIds = [...withReversals(state.ledger, [id])];
    await removeTransaction(id);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: removedIds });
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
    const replacedIds = transactions.filter((t) => t.transferId === transferId).map((t) => t.id);
    const txns = await replaceTransfer(transferId, rows);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: replacedIds });
    dispatch({ type: "ADD_TRANSACTIONS", payload: txns });
  });

  const deleteTransfer = useMemoizedFn(async (transferId: string) => {
    const error = overdraftError([], (t) => t.transferId === transferId);
    if (error) {
      throw error;
    }
    const removedIds = [
      ...withReversals(
        state.ledger,
        state.ledger.filter((t) => t.transferId === transferId).map((t) => t.id)
      ),
    ];
    await removeTransfer(transferId);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: removedIds });
  });

  const replacePayments = useMemoizedFn(
    async (expenseId: string, cycleYear: number | null, cycleMonth: number | null, payments: PaymentInput[]) => {
      const rows: Omit<AccountTransaction, "id">[] = [];
      for (const p of payments) {
        let account = state.accounts.find((a) => a.id === p.accountId);
        if (!account && state.isLoading && p.accountId != null) {
          account = await getAccountById(p.accountId);
        }
        // A ₱0 bill moved no money, so it leaves no row in the account.
        if (account && p.amount != null && round(p.amount, 2) > 0) {
          rows.push({
            ...emptyTxnFields(),
            accountId: account.id,
            kind: "payment",
            amount: account.type === "credit" ? round(p.amount, 2) : -round(p.amount, 2),
            expenseId,
            cycleYear,
            cycleMonth,
            note: p.note,
            createdAt: p.createdAt,
          });
        }
      }
      const isReplaced = isPaymentFor(expenseId, cycleYear, cycleMonth);
      const error = overdraftError(rows, isReplaced);
      if (error) {
        throw error;
      }
      const replacedIds = transactions.filter(isReplaced).map((t) => t.id);
      const inserted = await replacePaymentRows(expenseId, cycleYear, cycleMonth, rows);
      dispatch({ type: "REMOVE_TRANSACTIONS", payload: replacedIds });
      if (inserted.length > 0) {
        dispatch({ type: "ADD_TRANSACTIONS", payload: inserted });
      }
    }
  );

  const syncPayment = useMemoizedFn(async (p: PaymentSync) => {
    const existing = transactions.find(isPaymentFor(p.expenseId, p.cycleYear, p.cycleMonth));
    await replacePayments(p.expenseId, p.cycleYear, p.cycleMonth, [
      {
        accountId: p.accountId,
        amount: p.amount,
        note: p.note,
        createdAt: p.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      },
    ]);
  });

  const reverseTransactions = useMemoizedFn(async (ids: string[]): Promise<AccountTransaction[]> => {
    if (ids.length === 0) {
      return [];
    }
    const originals: AccountTransaction[] = [];
    for (const id of ids) {
      const original = transactions.find((t) => t.id === id);
      if (!original) {
        throw new Error("Already reverted");
      }
      originals.push(original);
    }
    const now = new Date().toISOString();
    const rows = originals.map((o) => buildReversal(o, now));
    const error = overdraftError(rows);
    if (error) {
      throw error;
    }
    const inserted = await insertReversals(rows);
    dispatch({ type: "ADD_TRANSACTIONS", payload: inserted });
    return inserted;
  });

  const undoReversals = useMemoizedFn(async (reversalIds: string[]): Promise<void> => {
    const ids = new Set(reversalIds);
    const reversals = state.ledger.filter((t) => t.kind === "reversal" && ids.has(t.id));
    const error = overdraftError(reversals.map((r) => ({ accountId: r.accountId, amount: -r.amount })));
    if (error) {
      throw error;
    }
    const removedIds = reversals.map((r) => r.id);
    await removeReversals(removedIds);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: removedIds });
  });

  const deletePayments = useMemoizedFn(async (expenseId: string, cycleYear: number | null, cycleMonth: number | null): Promise<void> => {
    const removedIds = [
      ...withReversals(
        state.ledger,
        state.ledger.filter(isPaymentFor(expenseId, cycleYear, cycleMonth)).map((t) => t.id)
      ),
    ];
    await removePayments(expenseId, cycleYear, cycleMonth);
    dispatch({ type: "REMOVE_TRANSACTIONS", payload: removedIds });
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
        const txns = transactions.filter((t) => t.accountId === account.id);
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
    [state.accounts, transactions, state.billOverrides]
  );

  const unsettledByCard = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const account of state.accounts) {
      if (isBillCard(account)) {
        map.set(account.id, unsettledDebitIds(transactions.filter((t) => t.accountId === account.id)));
      }
    }
    return map;
  }, [state.accounts, transactions]);

  const getPayments = useCallback(
    (expenseId: string, cycleYear: number | null, cycleMonth: number | null) =>
      [...(paymentsByCycle.get(paymentKey(expenseId, cycleYear, cycleMonth)) ?? [])],
    [paymentsByCycle]
  );

  const isTxnCharged = useCallback(
    (txn: AccountTransaction) => unsettledByCard.get(txn.accountId)?.has(txn.id) ?? false,
    [unsettledByCard]
  );

  const isCharged = useCallback(
    (expenseId: string, cycleYear: number | null, cycleMonth: number | null) =>
      getPayments(expenseId, cycleYear, cycleMonth).some(isTxnCharged),
    [getPayments, isTxnCharged]
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
      const payment = getPayments(expenseId, cycleYear, cycleMonth)[0];
      return isCardAccount(payment?.accountId ?? fallbackAccountId);
    },
    [getPayments, isCardAccount]
  );

  const value = useMemo(
    () => ({
      accounts: state.accounts,
      activeAccounts,
      nameOf,
      transactions,
      ledger: state.ledger,
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
      replacePayments,
      reverseTransactions,
      undoReversals,
      deletePayments,
      getPayments,
      isTxnCharged,
      getCardBills,
      setBillAmount,
      isCharged,
      isCardAccount,
      isCardCharge,
      reload,
      refresh,
    }),
    [state, transactions, activeAccounts, nameOf, netWorth, getCardBills, getPayments, isTxnCharged, isCharged, isCardAccount, isCardCharge]
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
