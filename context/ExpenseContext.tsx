import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { Expense, Status } from "../types";
import * as expensesDB from "../db/expenses";

interface State {
  expenses: Expense[];
  loading: boolean;
}

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string };

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
    default:
      return state;
  }
}

interface ExpenseContextValue {
  expenses: Expense[];
  loading: boolean;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
  });

  useEffect(() => {
    expensesDB.getAll().then((rows) => {
      dispatch({ type: "LOAD", payload: rows });
    });
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
        addExpense,
        toggleStatus,
        deleteExpense,
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
