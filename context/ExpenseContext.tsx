import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";
import { useAsyncEffect } from "../utils/useAsyncEffect";
import type { Expense, Status, MonthStatus, FeatherIconName } from "../types";
import * as expensesDB from "../db/expenses";
import * as preferencesDB from "../db/preferences";
import * as monthsDB from "../db/expenseMonths";
import { monthKey } from "../utils/monthKey";
import { getAllWithIds } from "../db/categories";

interface State {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  monthStatuses: Record<string, Status>;
  monthAmounts: Record<string, number | null>;
  categoryIconMap: Record<string, FeatherIconName>;
}

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string }
  | { type: "SET_USER_NAME"; payload: string | null }
  | { type: "LOAD_MONTHS"; payload: MonthStatus[] }
  | { type: "SET_MONTH_STATUS"; payload: { expenseId: string; year: number; month: number; status: Status } }
  | { type: "SET_MONTH_AMOUNT"; payload: { expenseId: string; year: number; month: number; amount: number | null } }
  | { type: "SET_CATEGORY_ICONS"; payload: Record<string, FeatherIconName> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { ...state, expenses: action.payload, loading: false };
    case "ADD":
      return {
        ...state,
        expenses: [...state.expenses, action.payload].sort(
          (a, b) => a.dueDay - b.dueDay
        ),
      };
    case "UPDATE":
      return {
        ...state,
        expenses: state.expenses
          .map((e) => (e.id === action.payload.id ? action.payload : e))
          .sort((a, b) => a.dueDay - b.dueDay),
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
      for (const m of action.payload) {
        statusMap[monthKey(m.expenseId, m.year, m.month)] = m.status;
        if (m.amount !== undefined) {
          amountMap[monthKey(m.expenseId, m.year, m.month)] = m.amount;
        }
      }
      return { ...state, monthStatuses: statusMap, monthAmounts: amountMap };
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
      const { expenseId, year, month, status } = action.payload;
      return {
        ...state,
        monthStatuses: {
          ...state.monthStatuses,
          [monthKey(expenseId, year, month)]: status,
        },
      };
    }
    case "SET_CATEGORY_ICONS":
      return { ...state, categoryIconMap: action.payload };
    default:
      return state;
  }
}

interface ExpenseContextValue {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
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
  toggleMonthStatus: (id: string, year: number, month: number) => Promise<void>;
  categoryIconMap: Record<string, FeatherIconName>;
  reloadCategoryIcons: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
    userName: null,
    monthStatuses: {},
    monthAmounts: {},
    categoryIconMap: {},
  });

  useAsyncEffect(async (active) => {
    try {
      const [rows, name, months, cats] = await Promise.all([
        expensesDB.getAll(),
        preferencesDB.getPreference("user_name"),
        monthsDB.getAll(),
        getAllWithIds(),
      ]);
      if (!active()) return;
      dispatch({ type: "LOAD", payload: rows });
      dispatch({ type: "SET_USER_NAME", payload: name });
      dispatch({ type: "LOAD_MONTHS", payload: months });
      const iconMap: Record<string, FeatherIconName> = {};
      for (const c of cats) iconMap[c.name] = c.icon;
      dispatch({ type: "SET_CATEGORY_ICONS", payload: iconMap });
    } catch {
      if (!active()) return;
      dispatch({ type: "LOAD", payload: [] });
      dispatch({ type: "LOAD_MONTHS", payload: [] });
    }
  }, []);

  const setUserName = useCallback((name: string | null) => {
    dispatch({ type: "SET_USER_NAME", payload: name });
  }, []);

  const addExpense = useCallback(
    async (e: Omit<Expense, "id" | "createdAt">, monthlyAmount?: { year: number; month: number; amount: number | null }) => {
      const saved = await expensesDB.insert(e);
      dispatch({ type: "ADD", payload: saved });
      if (e.isVariable && monthlyAmount !== undefined) {
        await monthsDB.upsertMonthlyAmount(saved.id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
        dispatch({
          type: "SET_MONTH_AMOUNT",
          payload: { expenseId: saved.id, year: monthlyAmount.year, month: monthlyAmount.month, amount: monthlyAmount.amount },
        });
      }
    },
    []
  );

  const updateExpense = useCallback(
    async (
      id: string,
      fields: Omit<Expense, "id" | "createdAt">,
      monthlyAmount?: { year: number; month: number; amount: number | null }
    ) => {
      const existing = state.expenses.find((e) => e.id === id);
      if (!existing) return;
      await expensesDB.update(id, fields);
      dispatch({ type: "UPDATE", payload: { ...existing, ...fields } });
      if (fields.isVariable && monthlyAmount !== undefined) {
        await monthsDB.upsertMonthlyAmount(id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
        dispatch({
          type: "SET_MONTH_AMOUNT",
          payload: { expenseId: id, year: monthlyAmount.year, month: monthlyAmount.month, amount: monthlyAmount.amount },
        });
      }
    },
    [state.expenses]
  );

  const getMonthStatus = useCallback(
    (id: string, year: number, month: number): Status => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) return "unpaid";
      if (expense.recurrence === "one-off") return expense.status;
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

  const toggleMonthStatus = useCallback(
    async (id: string, year: number, month: number): Promise<void> => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) return;

      if (expense.recurrence === "one-off") {
        const next: Status = expense.status === "unpaid" ? "paid" : "unpaid";
        await expensesDB.updateStatus(id, next);
        dispatch({ type: "UPDATE", payload: { ...expense, status: next } });
      } else {
        const current = state.monthStatuses[monthKey(id, year, month)] ?? "unpaid";
        const next: Status = current === "unpaid" ? "paid" : "unpaid";
        await monthsDB.upsertStatus(id, year, month, next);
        dispatch({ type: "SET_MONTH_STATUS", payload: { expenseId: id, year, month, status: next } });
      }
    },
    [state.expenses, state.monthStatuses]
  );

  const deleteExpense = useCallback(async (id: string) => {
    await expensesDB.remove(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  const reloadCategoryIcons = useCallback(async () => {
    const cats = await getAllWithIds();
    const iconMap: Record<string, FeatherIconName> = {};
    for (const c of cats) iconMap[c.name] = c.icon;
    dispatch({ type: "SET_CATEGORY_ICONS", payload: iconMap });
  }, []);

  const reloadAll = useCallback(async () => {
    const [rows, months, cats] = await Promise.all([
      expensesDB.getAll(),
      monthsDB.getAll(),
      getAllWithIds(),
    ]);
    dispatch({ type: "LOAD", payload: rows });
    dispatch({ type: "LOAD_MONTHS", payload: months });
    const iconMap: Record<string, FeatherIconName> = {};
    for (const c of cats) iconMap[c.name] = c.icon;
    dispatch({ type: "SET_CATEGORY_ICONS", payload: iconMap });
  }, []);

  return (
    <ExpenseContext.Provider
      value={{
        expenses: state.expenses,
        loading: state.loading,
        userName: state.userName,
        addExpense,
        updateExpense,
        deleteExpense,
        setUserName,
        getMonthStatus,
        getMonthAmount,
        toggleMonthStatus,
        categoryIconMap: state.categoryIconMap,
        reloadCategoryIcons,
        reloadAll,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpenseProvider");
  return ctx;
}
