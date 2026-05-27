import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { Expense, Status } from "../types";
import type { MonthStatus } from "../types";
import * as expensesDB from "../db/expenses";
import * as preferencesDB from "../db/preferences";
import * as monthsDB from "../db/expenseMonths";
import { monthKey } from "../utils/monthKey";

interface State {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  monthStatuses: Record<string, Status>;
}

type Action =
  | { type: "LOAD"; payload: Expense[] }
  | { type: "ADD"; payload: Expense }
  | { type: "UPDATE"; payload: Expense }
  | { type: "REMOVE"; payload: string }
  | { type: "SET_USER_NAME"; payload: string | null }
  | { type: "LOAD_MONTHS"; payload: MonthStatus[] }
  | { type: "SET_MONTH_STATUS"; payload: { expenseId: string; year: number; month: number; status: Status } };

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
      const map: Record<string, Status> = {};
      for (const m of action.payload) {
        map[monthKey(m.expenseId, m.year, m.month)] = m.status;
      }
      return { ...state, monthStatuses: map };
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
    default:
      return state;
  }
}

interface ExpenseContextValue {
  expenses: Expense[];
  loading: boolean;
  userName: string | null;
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (id: string, fields: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setUserName: (name: string | null) => void;
  getMonthStatus: (id: string, year: number, month: number) => Status;
  toggleMonthStatus: (id: string, year: number, month: number) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    expenses: [],
    loading: true,
    userName: null,
    monthStatuses: {},
  });

  useEffect(() => {
    Promise.all([
      expensesDB.getAll(),
      preferencesDB.getPreference("user_name"),
      monthsDB.getAll(),
    ]).then(([rows, name, months]) => {
      dispatch({ type: "LOAD", payload: rows });
      dispatch({ type: "SET_USER_NAME", payload: name });
      dispatch({ type: "LOAD_MONTHS", payload: months });
    }).catch(() => {
      dispatch({ type: "LOAD", payload: [] });
      dispatch({ type: "LOAD_MONTHS", payload: [] });
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

  const updateExpense = useCallback(
    async (id: string, fields: Omit<Expense, "id" | "createdAt">) => {
      const existing = state.expenses.find((e) => e.id === id);
      if (!existing) return;
      await expensesDB.update(id, fields);
      dispatch({ type: "UPDATE", payload: { ...existing, ...fields } });
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
        toggleMonthStatus,
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
