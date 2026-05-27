import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { Expense, Status } from "../types";
import * as expensesDB from "../db/expenses";
import * as preferencesDB from "../db/preferences";

interface State {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
}

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string }
  | { type: "SET_USER_NAME"; payload: string | null };

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
    default:
      return state;
  }
}

interface ExpenseContextValue {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setUserName: (name: string | null) => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
    userName: null,
  });

  useEffect(() => {
    Promise.all([
      expensesDB.getAll(),
      preferencesDB.getPreference("user_name"),
    ]).then(([rows, name]) => {
      dispatch({ type: "LOAD", payload: rows });
      dispatch({ type: "SET_USER_NAME", payload: name });
    }).catch(() => {
      dispatch({ type: "LOAD", payload: [] });
    });
  }, []);

  const setUserName = useCallback((name: string | null) => {
    dispatch({ type: "SET_USER_NAME", payload: name });
  }, []);

  const addExpense = useCallback(
    async (e: Omit<Expense, "id" | "createdAt">) => {
      const saved = await expensesDB.insert(e);
      dispatch({ type: "ADD", payload: saved });
    },
    []
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) return;

      if (expense.status === "unpaid") {
        await expensesDB.updateStatus(id, "paid");
        dispatch({ type: "UPDATE", payload: { ...expense, status: "paid" } });
      } else {
        await expensesDB.updateStatus(id, "unpaid");
        dispatch({ type: "UPDATE", payload: { ...expense, status: "unpaid" } });
      }
    },
    [state.expenses]
  );

  const deleteExpense = useCallback(async (id: string) => {
    await expensesDB.remove(id);
    dispatch({ type: "REMOVE", payload: id });
  }, []);

  return (
    <ExpenseContext.Provider
      value={{
        expenses: state.expenses,
        loading: state.loading,
        userName: state.userName,
        addExpense,
        toggleStatus,
        deleteExpense,
        setUserName,
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
