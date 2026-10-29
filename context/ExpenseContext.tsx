import { AppState } from "react-native";
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import { sortBy } from "@/utils/collections";
import dayjs from "dayjs";
import type { AccountTransaction, Expense, Status, MonthStatus, HomeBandSlot } from "@/types";
import * as expensesDB from "@/db/expenses";
import * as preferencesDB from "@/db/preferences";
import * as monthsDB from "@/db/expenseMonths";
import { monthKey, parseMonthKey } from "@/utils/monthKey";
import { scheduleAllNotifications, cancelAllNotifications, getExpenseReminders, getUnpaidBillReminders } from '@/utils/notifications';
import { useAccounts } from "@/context/AccountContext";

interface State {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  collapsedHomeBands: HomeBandSlot[];
  monthStatuses: Record<string, Status>;
  monthAmounts: Record<string, number | null>;
  monthPaidAts: Record<string, string | null>;
}

interface MonthState {
  status: Status;
  amount: number | null;
  paidAt: string | null;
}

// What paying a month records. Anything left out falls back to the expense: its amount (or the month's own amount
// for variable bills), now, and its Pay from account.
export interface PayDetails {
  amount?: number | null;
  paidAt?: string;
  accountId?: string | null;
}

// Puts a month back exactly as it was before a pay/unpay, payment transaction included.
export type UndoMonth = () => Promise<void>;

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string }
  | { type: "SET_USER_NAME"; payload: string | null }
  | { type: "SET_COLLAPSED_BANDS"; payload: HomeBandSlot[] }
  | { type: "LOAD_MONTHS"; payload: MonthStatus[] }
  | { type: "SET_MONTH"; payload: { expenseId: string; year: number; month: number } & MonthState }
  | { type: "SET_MONTH_AMOUNT"; payload: { expenseId: string; year: number; month: number; amount: number | null } };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { ...state, expenses: action.payload, loading: false };
    case "ADD":
      return {
        ...state,
        expenses: sortBy([...state.expenses, action.payload], "dueDay"),
      };
    case "UPDATE":
      return {
        ...state,
        expenses: sortBy(
          state.expenses.map((e) => (e.id === action.payload.id ? action.payload : e)),
          "dueDay"
        ),
      };
    case "REMOVE":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      };
    case "SET_USER_NAME":
      return { ...state, userName: action.payload };
    case "SET_COLLAPSED_BANDS":
      return { ...state, collapsedHomeBands: action.payload };
    case "LOAD_MONTHS": {
      const statusMap: Record<string, Status> = {};
      const amountMap: Record<string, number | null> = {};
      const paidAtMap: Record<string, string | null> = {};
      for (const m of action.payload) {
        const k = monthKey(m.expenseId, m.year, m.month);
        statusMap[k] = m.status;
        if (m.amount !== undefined) {
          amountMap[k] = m.amount;
        }
        paidAtMap[k] = m.paidAt ?? null;
      }
      return { ...state, monthStatuses: statusMap, monthAmounts: amountMap, monthPaidAts: paidAtMap };
    }
    case "SET_MONTH_AMOUNT": {
      const { expenseId, year, month, amount } = action.payload;
      return {
        ...state,
        monthAmounts: {
          ...state.monthAmounts,
          [monthKey(expenseId, year, month)]: amount,
        },
      };
    }
    case "SET_MONTH": {
      const { expenseId, year, month, status, amount, paidAt } = action.payload;
      const k = monthKey(expenseId, year, month);
      return {
        ...state,
        monthStatuses: { ...state.monthStatuses, [k]: status },
        monthAmounts: { ...state.monthAmounts, [k]: amount },
        monthPaidAts: { ...state.monthPaidAts, [k]: paidAt },
      };
    }
    default:
      return state;
  }
}

export interface PaidCycle {
  expenseId: string;
  year: number;
  month: number;
  paidAt: string | null;
}

interface ExpenseContextValue {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  collapsedHomeBands: HomeBandSlot[];
  paidCycles: PaidCycle[];
  addExpense: (e: Omit<Expense, "id" | "createdAt">, monthlyAmount?: { year: number; month: number; amount: number | null }) => Promise<void>;
  updateExpense: (
    id: string,
    fields: Omit<Expense, "id" | "createdAt">,
    monthlyAmount?: { year: number; month: number; amount: number | null }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setUserName: (name: string | null) => void;
  toggleHomeBand: (slot: HomeBandSlot) => Promise<void>;
  getMonthStatus: (id: string, year: number, month: number) => Status;
  getMonthAmount: (id: string, year: number, month: number) => number | null;
  // What the cycle costs: the amount paid for paid months, the month's own amount for variable expenses,
  // else the expense's amount. Null when unknown (shown as TBD).
  getDisplayAmount: (expense: Expense, year: number, month: number) => number | null;
  resolveAmount: (expense: Expense, year: number, month: number) => number;
  getMonthPaidAt: (id: string, year: number, month: number) => string | null;
  toggleMonthStatus: (id: string, year: number, month: number) => Promise<void>;
  // Recurring months only. Both throw when the write fails (the month is left as it was).
  payMonth: (id: string, year: number, month: number, details?: PayDetails) => Promise<UndoMonth>;
  unpayMonth: (id: string, year: number, month: number) => Promise<UndoMonth>;
  reloadAll: () => Promise<void>;
  rescheduleNotifications: () => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

function paidDateTimestamp(expense: Pick<Expense, "paidDate">): string | undefined {
  return expense.paidDate ? dayjs(expense.paidDate).endOf("day").toISOString() : undefined;
}

function paymentNote(expense: Pick<Expense, "name" | "category">): string {
  return expense.name || expense.category;
}

function parseCollapsedBands(raw: string | null): HomeBandSlot[] {
  if (raw == null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is HomeBandSlot => v === "current" || v === "next") : [];
  } catch {
    return [];
  }
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const accounts = useAccounts();
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
    userName: null,
    collapsedHomeBands: [],
    monthStatuses: {},
    monthAmounts: {},
    monthPaidAts: {},
  });

  useAsyncEffect(async function* () {
    try {
      const [rows, name, months, collapsedBands] = await Promise.all([
        expensesDB.getAll(),
        preferencesDB.getPreference("user_name"),
        monthsDB.getAll(),
        preferencesDB.getPreference("homeCollapsedBands"),
      ]);
      yield;
      dispatch({ type: "LOAD", payload: rows });
      dispatch({ type: "SET_USER_NAME", payload: name });
      dispatch({ type: "SET_COLLAPSED_BANDS", payload: parseCollapsedBands(collapsedBands) });
      dispatch({ type: "LOAD_MONTHS", payload: months });
    } catch {
      yield;
      dispatch({ type: "LOAD", payload: [] });
      dispatch({ type: "LOAD_MONTHS", payload: [] });
    }
  }, []);

  // Every paid recurring cycle, derived from the month maps. The ledger keys off
  // these (by pay-date) rather than an expense's current-month status, so an
  // advance payment surfaces in the month it was actually paid.
  const paidCycles = useMemo<PaidCycle[]>(() => {
    const out: PaidCycle[] = [];
    for (const [k, status] of Object.entries(state.monthStatuses)) {
      if (status !== "paid") {
        continue;
      }
      const { id, year, month } = parseMonthKey(k);
      out.push({ expenseId: id, year, month, paidAt: state.monthPaidAts[k] ?? null });
    }
    return out;
  }, [state.monthStatuses, state.monthPaidAts]);

  const setUserName = useMemoizedFn((name: string | null) => {
    dispatch({ type: "SET_USER_NAME", payload: name });
  });

  const toggleHomeBand = useMemoizedFn(async (slot: HomeBandSlot) => {
    const next = state.collapsedHomeBands.includes(slot)
      ? state.collapsedHomeBands.filter((s) => s !== slot)
      : [...state.collapsedHomeBands, slot];
    try {
      await preferencesDB.setPreference("homeCollapsedBands", JSON.stringify(next));
      dispatch({ type: "SET_COLLAPSED_BANDS", payload: next });
    } catch (err) {
      console.error("Saving collapsed bands failed", err);
    }
  });

  const addExpense = useMemoizedFn(
    async (e: Omit<Expense, "id" | "createdAt">, monthlyAmount?: { year: number; month: number; amount: number | null }) => {
      const saved = await expensesDB.insert(e);
      dispatch({ type: "ADD", payload: saved });
      if (saved.recurrence === "one-off") {
        try {
          await accounts.syncPayment({
            expenseId: saved.id,
            accountId: saved.accountId,
            cycleYear: null,
            cycleMonth: null,
            amount: saved.amount,
            note: paymentNote(saved),
            createdAt: paidDateTimestamp(saved),
          });
        } catch (err) {
          console.error("Failed to sync one-off payment, removing expense", err);
          await expensesDB.remove(saved.id);
          dispatch({ type: "REMOVE", payload: saved.id });
          throw err;
        }
      }
      if (e.isVariable && monthlyAmount !== undefined) {
        await monthsDB.upsertMonthlyAmount(saved.id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
        dispatch({
          type: "SET_MONTH_AMOUNT",
          payload: { expenseId: saved.id, year: monthlyAmount.year, month: monthlyAmount.month, amount: monthlyAmount.amount },
        });
      }
    }
  );

  const updateExpense = useMemoizedFn(
    async (
      id: string,
      fields: Omit<Expense, "id" | "createdAt">,
      monthlyAmount?: { year: number; month: number; amount: number | null }
    ) => {
      const existing = state.expenses.find((e) => e.id === id);
      if (!existing) {
        return;
      }
      await expensesDB.update(id, fields);
      dispatch({ type: "UPDATE", payload: { ...existing, ...fields } });
      if (fields.isVariable && monthlyAmount !== undefined) {
        await monthsDB.upsertMonthlyAmount(id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
        dispatch({
          type: "SET_MONTH_AMOUNT",
          payload: { expenseId: id, year: monthlyAmount.year, month: monthlyAmount.month, amount: monthlyAmount.amount },
        });
        const { year, month } = monthlyAmount;
        if (fields.recurrence !== "one-off" && state.monthStatuses[monthKey(id, year, month)] === "paid") {
          const paidTxn = accounts.transactions.find(
            (t) => t.kind === "payment" && t.expenseId === id && t.cycleYear === year && t.cycleMonth === month
          );
          if (paidTxn) {
            await accounts.syncPayment({
              expenseId: id,
              accountId: paidTxn.accountId,
              cycleYear: year,
              cycleMonth: month,
              amount: monthlyAmount.amount,
              note: paymentNote(fields),
            });
          }
        }
      }
      try {
        if (fields.recurrence === "one-off" && fields.status === "paid") {
          await accounts.syncPayment({
            expenseId: id,
            accountId: fields.accountId,
            cycleYear: null,
            cycleMonth: null,
            amount: fields.amount,
            note: paymentNote(fields),
            createdAt: paidDateTimestamp(fields),
          });
        } else if (existing.recurrence === "one-off") {
          await accounts.removePayment(id, null, null);
        }
      } catch (err) {
        console.error("Failed to sync one-off payment, reverting expense", err);
        await expensesDB.update(id, existing);
        dispatch({ type: "UPDATE", payload: existing });
        throw err;
      }
    }
  );

  const getMonthStatus = useCallback(
    (id: string, year: number, month: number): Status => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) {
        return "unpaid";
      }
      if (expense.recurrence === "one-off") {
        return expense.status;
      }
      return state.monthStatuses[monthKey(id, year, month)] ?? "unpaid";
    },
    [state.expenses, state.monthStatuses]
  );

  const getMonthAmount = useCallback(
    (id: string, year: number, month: number): number | null => {
      return state.monthAmounts[monthKey(id, year, month)] ?? null;
    },
    [state.monthAmounts]
  );

  const getDisplayAmount = useCallback(
    (expense: Expense, year: number, month: number): number | null => {
      if (expense.recurrence === "one-off") {
        return expense.amount;
      }
      const k = monthKey(expense.id, year, month);
      const stored = state.monthAmounts[k] ?? null;
      if (expense.isVariable || (state.monthStatuses[k] === "paid" && stored != null)) {
        return stored;
      }
      return expense.amount;
    },
    [state.monthAmounts, state.monthStatuses]
  );

  const resolveAmount = useCallback(
    (expense: Expense, year: number, month: number): number => getDisplayAmount(expense, year, month) ?? 0,
    [getDisplayAmount]
  );

  const getMonthPaidAt = useCallback(
    (id: string, year: number, month: number): string | null => {
      return state.monthPaidAts[monthKey(id, year, month)] ?? null;
    },
    [state.monthPaidAts]
  );

  const rescheduleGeneration = useRef(0);
  const rescheduleQueue = useRef<Promise<void>>(Promise.resolve());

  const rescheduleNotifications = useMemoizedFn(() => {
    if (state.loading || accounts.isLoading) {
      return;
    }
    rescheduleGeneration.current += 1;
    const generation = rescheduleGeneration.current;
    const previous = rescheduleQueue.current;
    const run = (async () => {
      await previous;
      try {
        const enabled = await preferencesDB.getPreference('notificationsEnabled');
        if (generation !== rescheduleGeneration.current) {
          return;
        }
        if (enabled === 'false') {
          await cancelAllNotifications();
          return;
        }
        const time = (await preferencesDB.getPreference('reminderTime')) ?? '09:00';
        if (generation !== rescheduleGeneration.current) {
          return;
        }
        const now = new Date();
        await scheduleAllNotifications(
          [
            ...getExpenseReminders(state.expenses, getMonthStatus, getDisplayAmount, now),
            ...getUnpaidBillReminders(accounts.getCardBills, now),
          ],
          time
        );
      } catch (err) {
        console.error('[notifications] reschedule error:', err);
      }
    })();
    rescheduleQueue.current = run;
  });

  useEffect(() => {
    rescheduleNotifications();
  }, [state.expenses, state.monthStatuses, state.monthAmounts, state.loading, accounts.isLoading, accounts.transactions, accounts.billOverrides, accounts.accounts]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        rescheduleNotifications();
      }
    });
    return () => subscription.remove();
  }, []);

  const writeMonth = useMemoizedFn(async (expenseId: string, year: number, month: number, next: MonthState) => {
    await monthsDB.setMonth(expenseId, year, month, next.status, next.amount, next.paidAt);
    dispatch({ type: "SET_MONTH", payload: { expenseId, year, month, ...next } });
  });

  const monthStateOf = (id: string, year: number, month: number): MonthState => {
    const k = monthKey(id, year, month);
    return {
      status: state.monthStatuses[k] ?? "unpaid",
      amount: state.monthAmounts[k] ?? null,
      paidAt: state.monthPaidAts[k] ?? null,
    };
  };

  const paymentTxnOf = (id: string, year: number, month: number) =>
    accounts.transactions.find(
      (t) => t.kind === "payment" && t.expenseId === id && t.cycleYear === year && t.cycleMonth === month
    );

  const recurringExpense = (id: string): Expense => {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense || expense.recurrence === "one-off") {
      throw new Error("Only recurring expenses have months to pay");
    }
    return expense;
  };

  const restoreMonth = useMemoizedFn(
    async (expense: Expense, year: number, month: number, previous: MonthState, previousTxn?: AccountTransaction) => {
      await writeMonth(expense.id, year, month, previous);
      if (previousTxn) {
        await accounts.syncPayment({
          expenseId: expense.id,
          accountId: previousTxn.accountId,
          cycleYear: year,
          cycleMonth: month,
          amount: Math.abs(previousTxn.amount),
          note: previousTxn.note ?? paymentNote(expense),
          createdAt: previousTxn.createdAt,
        });
      } else {
        await accounts.removePayment(expense.id, year, month);
      }
    }
  );

  const payMonth = useMemoizedFn(
    async (id: string, year: number, month: number, details: PayDetails = {}): Promise<UndoMonth> => {
      const expense = recurringExpense(id);
      const previous = monthStateOf(id, year, month);
      const previousTxn = paymentTxnOf(id, year, month);
      // Variable months keep their own amount. A fixed expense's paid month records what it cost, so a later
      // edit doesn't rewrite paid history.
      const amount = details.amount !== undefined ? details.amount : expense.isVariable ? previous.amount : expense.amount;
      const paidAt = details.paidAt ?? new Date().toISOString();
      await writeMonth(id, year, month, { status: "paid", amount, paidAt });
      try {
        await accounts.syncPayment({
          expenseId: id,
          accountId: details.accountId !== undefined ? details.accountId : expense.accountId,
          cycleYear: year,
          cycleMonth: month,
          amount,
          note: paymentNote(expense),
          createdAt: paidAt,
        });
      } catch (err) {
        await writeMonth(id, year, month, previous);
        throw err;
      }
      return () => restoreMonth(expense, year, month, previous, previousTxn);
    }
  );

  const unpayMonth = useMemoizedFn(async (id: string, year: number, month: number): Promise<UndoMonth> => {
    const expense = recurringExpense(id);
    const previous = monthStateOf(id, year, month);
    const previousTxn = paymentTxnOf(id, year, month);
    // A fixed expense's month follows the expense again once unpaid; variable months keep their own amount.
    await writeMonth(id, year, month, { status: "unpaid", amount: expense.isVariable ? previous.amount : null, paidAt: null });
    try {
      await accounts.removePayment(id, year, month);
    } catch (err) {
      await writeMonth(id, year, month, previous);
      throw err;
    }
    return () => restoreMonth(expense, year, month, previous, previousTxn);
  });

  const toggleMonthStatus = useMemoizedFn(
    async (id: string, year: number, month: number): Promise<void> => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) {
        return;
      }

      if (expense.recurrence === "one-off") {
        const next: Status = expense.status === "unpaid" ? "paid" : "unpaid";
        await expensesDB.updateStatus(id, next);
        dispatch({ type: "UPDATE", payload: { ...expense, status: next } });
        try {
          if (next === "paid") {
            await accounts.syncPayment({
              expenseId: id,
              accountId: expense.accountId,
              cycleYear: null,
              cycleMonth: null,
              amount: expense.amount,
              note: paymentNote(expense),
              createdAt: paidDateTimestamp(expense),
            });
          } else {
            await accounts.removePayment(id, null, null);
          }
        } catch (err) {
          console.error("Failed to sync payment, reverting status", err);
          await expensesDB.updateStatus(id, expense.status);
          dispatch({ type: "UPDATE", payload: expense });
          throw err;
        }
      } else {
        try {
          if (monthStateOf(id, year, month).status === "paid") {
            await unpayMonth(id, year, month);
          } else {
            await payMonth(id, year, month);
          }
        } catch (err) {
          console.error("Failed to sync payment, reverting status", err);
          throw err;
        }
      }
    }
  );

  const deleteExpense = useMemoizedFn(async (id: string) => {
    const expense = state.expenses.find((e) => e.id === id);
    if (expense?.recurrence === "one-off") {
      await accounts.removePayment(id, null, null);
    }
    await expensesDB.remove(id);
    dispatch({ type: "REMOVE", payload: id });
  });

  const reloadAll = useMemoizedFn(async () => {
    const [rows, months, name, collapsedBands] = await Promise.all([
      expensesDB.getAll(),
      monthsDB.getAll(),
      preferencesDB.getPreference("user_name"),
      preferencesDB.getPreference("homeCollapsedBands"),
    ]);
    dispatch({ type: "LOAD", payload: rows });
    dispatch({ type: "LOAD_MONTHS", payload: months });
    dispatch({ type: "SET_USER_NAME", payload: name });
    dispatch({ type: "SET_COLLAPSED_BANDS", payload: parseCollapsedBands(collapsedBands) });
  });

  const value = useMemo<ExpenseContextValue>(
    () => ({
      expenses: state.expenses,
      loading: state.loading,
      userName: state.userName,
      collapsedHomeBands: state.collapsedHomeBands,
      paidCycles,
      addExpense,
      updateExpense,
      deleteExpense,
      setUserName,
      toggleHomeBand,
      getMonthStatus,
      getMonthAmount,
      getDisplayAmount,
      resolveAmount,
      getMonthPaidAt,
      toggleMonthStatus,
      payMonth,
      unpayMonth,
      reloadAll,
      rescheduleNotifications,
    }),
    [
      state.expenses,
      state.loading,
      state.userName,
      state.collapsedHomeBands,
      paidCycles,
      getMonthStatus,
      getMonthAmount,
      getDisplayAmount,
      resolveAmount,
      getMonthPaidAt,
    ]
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) {
    throw new Error("useExpenses must be used within ExpenseProvider");
  }
  return ctx;
}
