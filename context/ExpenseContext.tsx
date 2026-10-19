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
import useAsyncEffect from "ahooks/es/useAsyncEffect";
import useMemoizedFn from "ahooks/es/useMemoizedFn";
import sortBy from "lodash/sortBy";
import dayjs from "dayjs";
import type { Expense, Status, MonthStatus } from "@/types";
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
  monthStatuses: Record<string, Status>;
  monthAmounts: Record<string, number | null>;
  monthPaidAts: Record<string, string | null>;
}

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string }
  | { type: "SET_USER_NAME"; payload: string | null }
  | { type: "LOAD_MONTHS"; payload: MonthStatus[] }
  | { type: "SET_MONTH_STATUS"; payload: { expenseId: string; year: number; month: number; status: Status; paidAt: string | null } }
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
    case "SET_MONTH_STATUS": {
      const { expenseId, year, month, status, paidAt } = action.payload;
      const k = monthKey(expenseId, year, month);
      return {
        ...state,
        monthStatuses: { ...state.monthStatuses, [k]: status },
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
  paidCycles: PaidCycle[];
  addExpense: (e: Omit<Expense, "id" | "createdAt">, monthlyAmount?: { year: number; month: number; amount: number | null }) => Promise<void>;
  updateExpense: (
    id: string,
    fields: Omit<Expense, "id" | "createdAt">,
    monthlyAmount?: { year: number; month: number; amount: number | null }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setUserName: (name: string | null) => void;
  getMonthStatus: (id: string, year: number, month: number) => Status;
  getMonthAmount: (id: string, year: number, month: number) => number | null;
  resolveAmount: (expense: Expense, year: number, month: number) => number;
  getMonthPaidAt: (id: string, year: number, month: number) => string | null;
  toggleMonthStatus: (id: string, year: number, month: number) => Promise<void>;
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

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const accounts = useAccounts();
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
    userName: null,
    monthStatuses: {},
    monthAmounts: {},
    monthPaidAts: {},
  });

  useAsyncEffect(async function* () {
    try {
      const [rows, name, months] = await Promise.all([
        expensesDB.getAll(),
        preferencesDB.getPreference("user_name"),
        monthsDB.getAll(),
      ]);
      yield;
      dispatch({ type: "LOAD", payload: rows });
      dispatch({ type: "SET_USER_NAME", payload: name });
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
        return;
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
          [...getExpenseReminders(state.expenses, getMonthStatus, now), ...getUnpaidBillReminders(accounts.getCardBills, now)],
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
  }, [state.expenses, state.monthStatuses, state.loading, accounts.isLoading, accounts.transactions, accounts.billOverrides, accounts.accounts]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        rescheduleNotifications();
      }
    });
    return () => subscription.remove();
  }, []);

  const getMonthAmount = useCallback(
    (id: string, year: number, month: number): number | null => {
      return state.monthAmounts[monthKey(id, year, month)] ?? null;
    },
    [state.monthAmounts]
  );

  const resolveAmount = useCallback(
    (expense: Expense, year: number, month: number): number =>
      expense.isVariable ? (getMonthAmount(expense.id, year, month) ?? 0) : (expense.amount ?? 0),
    [getMonthAmount]
  );

  const getMonthPaidAt = useCallback(
    (id: string, year: number, month: number): string | null => {
      return state.monthPaidAts[monthKey(id, year, month)] ?? null;
    },
    [state.monthPaidAts]
  );

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
          return;
        }
      } else {
        const current = state.monthStatuses[monthKey(id, year, month)] ?? "unpaid";
        const next: Status = current === "unpaid" ? "paid" : "unpaid";
        const paidAt = next === "paid" ? new Date().toISOString() : null;
        await monthsDB.upsertStatus(id, year, month, next, paidAt);
        dispatch({ type: "SET_MONTH_STATUS", payload: { expenseId: id, year, month, status: next, paidAt } });
        try {
          if (next === "paid") {
            await accounts.syncPayment({
              expenseId: id,
              accountId: expense.accountId,
              cycleYear: year,
              cycleMonth: month,
              amount: expense.isVariable ? getMonthAmount(id, year, month) : expense.amount,
              note: paymentNote(expense),
            });
          } else {
            await accounts.removePayment(id, year, month);
          }
        } catch (err) {
          console.error("Failed to sync payment, reverting status", err);
          const previousPaidAt = getMonthPaidAt(id, year, month);
          await monthsDB.upsertStatus(id, year, month, current, previousPaidAt);
          dispatch({ type: "SET_MONTH_STATUS", payload: { expenseId: id, year, month, status: current, paidAt: previousPaidAt } });
          return;
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
    const [rows, months] = await Promise.all([
      expensesDB.getAll(),
      monthsDB.getAll(),
    ]);
    dispatch({ type: "LOAD", payload: rows });
    dispatch({ type: "LOAD_MONTHS", payload: months });
  });

  return (
    <ExpenseContext.Provider
      value={{
        expenses: state.expenses,
        loading: state.loading,
        userName: state.userName,
        paidCycles,
        addExpense,
        updateExpense,
        deleteExpense,
        setUserName,
        getMonthStatus,
        getMonthAmount,
        resolveAmount,
        getMonthPaidAt,
        toggleMonthStatus,
        reloadAll,
        rescheduleNotifications,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) {
    throw new Error("useExpenses must be used within ExpenseProvider");
  }
  return ctx;
}
