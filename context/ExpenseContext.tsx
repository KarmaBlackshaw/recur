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
import { keyBy, sortBy, sumBy } from "@/utils/collections";
import { round } from "@/utils/round";
import { formatAmount } from "@/utils/formatAmount";
import dayjs from "dayjs";
import type { AccountTransaction, Expense, Status, MonthStatus, HomeBandSlot } from "@/types";
import {
  getAll as getAllExpenses,
  insert as insertExpense,
  remove as removeExpense,
  update as updateExpenseRow,
  updateStatus as updateExpenseStatus,
} from "@/db/expenses";
import { getPreference, setPreference } from "@/db/preferences";
import { getAll as getAllMonths, setMonth, upsertMonthlyAmount } from "@/db/expenseMonths";
import { monthKey, parseMonthKey } from "@/utils/monthKey";
import { scheduleAllNotifications, cancelAllNotifications, getExpenseReminders, getUnpaidBillReminders } from '@/utils/notifications';
import { useAccounts, type PaymentInput } from "@/context/AccountContext";
import { payFromAccountId } from "@/utils/accounts/payFromAccountId";
import { billProgress, canPayPart, type BillProgress } from "@/utils/expenses/billProgress";
import { BillPaymentError } from "@/utils/expenses/BillPaymentError";

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

// What paying a month records. Anything left out falls back to the expense: its amount (what's left once part-paid,
// or the month's own amount for variable bills), now, and its Pay from account (Cash when it has none or that one is
// archived or deleted).
export interface PayDetails {
  amount?: number | null;
  paidAt?: string;
  accountId?: string;
}

// Puts a month back exactly as it was before a write, all its payment transactions included.
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
  // What the cycle costs: the amount paid for paid months, the amount frozen at a fixed bill's first part payment,
  // the month's own amount for variable expenses, else the expense's amount. Null when unknown (shown as TBD).
  getDisplayAmount: (expense: Expense, year: number, month: number) => number | null;
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  resolveAmount: (expense: Expense, year: number, month: number) => number;
  getMonthPaidAt: (id: string, year: number, month: number) => string | null;
  toggleMonthStatus: (id: string, year: number, month: number) => Promise<void>;
  // Recurring months only. All throw when the write fails (the month is left as it was).
  payMonth: (id: string, year: number, month: number, details?: PayDetails) => Promise<UndoMonth>;
  payPart: (id: string, year: number, month: number, details: PayDetails & { amount: number }) => Promise<UndoMonth>;
  updatePayment: (paymentId: string, details: { amount: number; paidAt: string; accountId: string }) => Promise<UndoMonth>;
  revertPayment: (paymentId: string) => Promise<UndoMonth>;
  unpayMonth: (id: string, year: number, month: number) => Promise<UndoMonth>;
  reloadAll: () => Promise<void>;
  rescheduleNotifications: () => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

function paymentNote(expense: Pick<Expense, "name" | "category">): string {
  return expense.name || expense.category;
}

function paymentInputOf(txn: AccountTransaction, expense: Pick<Expense, "name" | "category">): PaymentInput {
  return {
    accountId: txn.accountId,
    amount: Math.abs(txn.amount),
    note: txn.note ?? paymentNote(expense),
    createdAt: txn.createdAt,
  };
}

function paidSum(txns: AccountTransaction[]): number {
  return round(sumBy(txns, (t) => Math.abs(t.amount)), 2);
}

function latestDate(dates: string[]): string {
  return dates.reduce((latest, date) => (dayjs(date).isAfter(latest) ? date : latest));
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
  const expensesById = useMemo(() => keyBy(state.expenses, "id"), [state.expenses]);

  useAsyncEffect(async function* () {
    try {
      const [rows, name, months, collapsedBands] = await Promise.all([
        getAllExpenses(),
        getPreference("user_name"),
        getAllMonths(),
        getPreference("homeCollapsedBands"),
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
      await setPreference("homeCollapsedBands", JSON.stringify(next));
      dispatch({ type: "SET_COLLAPSED_BANDS", payload: next });
    } catch (err) {
      console.error("Saving collapsed bands failed", err);
    }
  });

  const addExpense = useMemoizedFn(
    async (e: Omit<Expense, "id" | "createdAt">, monthlyAmount?: { year: number; month: number; amount: number | null }) => {
      const saved = await insertExpense(e);
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
            createdAt: saved.paidDate ?? undefined,
          });
        } catch (err) {
          console.error("Failed to sync one-off payment, removing expense", err);
          await removeExpense(saved.id);
          dispatch({ type: "REMOVE", payload: saved.id });
          throw err;
        }
      }
      if (e.isVariable && monthlyAmount !== undefined) {
        await upsertMonthlyAmount(saved.id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
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
      const monthPayments =
        fields.isVariable && fields.recurrence !== "one-off" && monthlyAmount !== undefined
          ? variableMonthPayments(id, fields, monthlyAmount)
          : undefined;
      await updateExpenseRow(id, fields);
      dispatch({ type: "UPDATE", payload: { ...existing, ...fields } });
      if (fields.isVariable && monthlyAmount !== undefined) {
        await upsertMonthlyAmount(id, monthlyAmount.year, monthlyAmount.month, monthlyAmount.amount);
        dispatch({
          type: "SET_MONTH_AMOUNT",
          payload: { expenseId: id, year: monthlyAmount.year, month: monthlyAmount.month, amount: monthlyAmount.amount },
        });
        if (monthPayments) {
          await accounts.replacePayments(id, monthlyAmount.year, monthlyAmount.month, monthPayments);
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
            createdAt: fields.paidDate ?? undefined,
          });
        } else if (existing.recurrence === "one-off") {
          await reverseOneOffPayment(id);
        }
      } catch (err) {
        console.error("Failed to sync one-off payment, reverting expense", err);
        await updateExpenseRow(id, existing);
        dispatch({ type: "UPDATE", payload: existing });
        throw err;
      }
    }
  );

  const getMonthStatus = useCallback(
    (id: string, year: number, month: number): Status => {
      const expense = expensesById[id];
      if (!expense) {
        return "unpaid";
      }
      if (expense.recurrence === "one-off") {
        return expense.status;
      }
      return state.monthStatuses[monthKey(id, year, month)] ?? "unpaid";
    },
    [expensesById, state.monthStatuses]
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
      if (expense.isVariable) {
        return stored;
      }
      if (stored != null && (state.monthStatuses[k] === "paid" || accounts.getPayments(expense.id, year, month).length > 0)) {
        return stored;
      }
      return expense.amount;
    },
    [state.monthAmounts, state.monthStatuses, accounts.getPayments]
  );

  const getBillProgress = useCallback(
    (expense: Expense, year: number, month: number): BillProgress => {
      if (expense.recurrence === "one-off") {
        const isPaid = expense.status === "paid";
        return billProgress({
          bill: expense.amount,
          payments: isPaid && expense.amount != null ? [expense.amount] : [],
          isPaid,
        });
      }
      return billProgress({
        bill: getDisplayAmount(expense, year, month),
        payments: accounts.getPayments(expense.id, year, month).map((t) => Math.abs(t.amount)),
        isPaid: state.monthStatuses[monthKey(expense.id, year, month)] === "paid",
      });
    },
    [getDisplayAmount, accounts.getPayments, state.monthStatuses]
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
        const enabled = await getPreference('notificationsEnabled');
        if (generation !== rescheduleGeneration.current) {
          return;
        }
        if (enabled === 'false') {
          await cancelAllNotifications();
          return;
        }
        const time = (await getPreference('reminderTime')) ?? '09:00';
        if (generation !== rescheduleGeneration.current) {
          return;
        }
        const now = new Date();
        await scheduleAllNotifications(
          [
            ...getExpenseReminders(state.expenses, getMonthStatus, (e, y, m) => getBillProgress(e, y, m).left, now),
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
    await setMonth(expenseId, year, month, next.status, next.amount, next.paidAt);
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

  const recurringExpense = (id: string): Expense => {
    const expense = state.expenses.find((e) => e.id === id);
    if (!expense || expense.recurrence === "one-off") {
      throw new Error("Only recurring expenses have months to pay");
    }
    return expense;
  };

  const paymentMonth = (paymentId: string) => {
    const payment = accounts.transactions.find((t) => t.id === paymentId && t.kind === "payment");
    if (!payment || payment.expenseId == null || payment.cycleYear == null || payment.cycleMonth == null) {
      throw new Error("Payment not found");
    }
    return { expense: recurringExpense(payment.expenseId), year: payment.cycleYear, month: payment.cycleMonth };
  };

  const withNewPayment = (
    expense: Expense,
    year: number,
    month: number,
    amount: number | null,
    { paidAt, accountId }: { paidAt: string; accountId?: string }
  ): PaymentInput[] => [
    ...accounts.getPayments(expense.id, year, month).map((t) => paymentInputOf(t, expense)),
    {
      accountId: accountId ?? payFromAccountId(expense, accounts.activeAccounts),
      amount,
      note: paymentNote(expense),
      createdAt: paidAt,
    },
  ];

  // Throws before anything is written when the month's new amount is below what's already paid toward it.
  const variableMonthPayments = (
    id: string,
    fields: Pick<Expense, "name" | "category">,
    { year, month, amount }: { year: number; month: number; amount: number | null }
  ): PaymentInput[] | undefined => {
    const rows = accounts.getPayments(id, year, month);
    if (state.monthStatuses[monthKey(id, year, month)] !== "paid") {
      const paid = paidSum(rows);
      if (rows.length > 0 && amount != null && amount < paid) {
        throw new BillPaymentError(`Already paid ${formatAmount(paid)} this month.`);
      }
      return undefined;
    }
    const settling = rows[rows.length - 1];
    if (!settling) {
      return undefined;
    }
    const others = rows.slice(0, -1);
    let settlingAmount = amount;
    if (others.length > 0) {
      const othersPaid = paidSum(others);
      settlingAmount = round((amount ?? 0) - othersPaid, 2);
      if (settlingAmount <= 0) {
        throw new BillPaymentError(`Already paid ${formatAmount(othersPaid)} this month.`);
      }
    }
    return [
      ...others.map((t) => paymentInputOf(t, fields)),
      { accountId: settling.accountId, amount: settlingAmount, note: paymentNote(fields), createdAt: settling.createdAt },
    ];
  };

  // The undo throws (leaving the month as it was) when restoring a payment would overdraw its account.
  const writeMonthPayments = useMemoizedFn(
    async (expense: Expense, year: number, month: number, next: MonthState, payments: PaymentInput[]): Promise<UndoMonth> => {
      const previous = monthStateOf(expense.id, year, month);
      const previousRows = accounts.getPayments(expense.id, year, month);
      await writeMonth(expense.id, year, month, next);
      try {
        await accounts.replacePayments(expense.id, year, month, payments);
      } catch (err) {
        await writeMonth(expense.id, year, month, previous);
        throw err;
      }
      return async () => {
        await writeMonthPayments(expense, year, month, previous, previousRows.map((t) => paymentInputOf(t, expense)));
      };
    }
  );

  const undoMonthReversal = useMemoizedFn(
    async ({
      expenseId,
      year,
      month,
      previous,
      reversalIds,
      liveIds,
    }: {
      expenseId: string;
      year: number;
      month: number;
      previous: MonthState;
      reversalIds: string[];
      liveIds: string[];
    }): Promise<void> => {
      const currentIds = new Set(accounts.getPayments(expenseId, year, month).map((t) => t.id));
      const isUnchanged = currentIds.size === liveIds.length && liveIds.every((id) => currentIds.has(id));
      if (!isUnchanged) {
        throw new BillPaymentError("This month changed since. Undo isn't available.");
      }
      if (reversalIds.length > 0) {
        await accounts.undoReversals(reversalIds);
      }
      await writeMonth(expenseId, year, month, previous);
    }
  );

  const reverseMonthPayments = useMemoizedFn(
    async ({
      expense,
      year,
      month,
      next,
      paymentIds,
    }: {
      expense: Expense;
      year: number;
      month: number;
      next: MonthState;
      paymentIds: string[];
    }): Promise<UndoMonth> => {
      const previous = monthStateOf(expense.id, year, month);
      const reversing = new Set(paymentIds);
      const liveIds = accounts
        .getPayments(expense.id, year, month)
        .map((t) => t.id)
        .filter((id) => !reversing.has(id));
      await writeMonth(expense.id, year, month, next);
      let reversals: AccountTransaction[] = [];
      try {
        if (paymentIds.length > 0) {
          reversals = await accounts.reverseTransactions(paymentIds);
        }
      } catch (err) {
        await writeMonth(expense.id, year, month, previous);
        throw err;
      }
      const reversalIds = reversals.map((t) => t.id);
      return () => undoMonthReversal({ expenseId: expense.id, year, month, previous, reversalIds, liveIds });
    }
  );

  const reverseOneOffPayment = useMemoizedFn(async (id: string) => {
    const paymentIds = accounts.getPayments(id, null, null).map((t) => t.id);
    if (paymentIds.length > 0) {
      await accounts.reverseTransactions(paymentIds);
    }
  });

  const payMonth = useMemoizedFn(
    async (id: string, year: number, month: number, details: PayDetails = {}): Promise<UndoMonth> => {
      const expense = recurringExpense(id);
      const previous = monthStateOf(id, year, month);
      const progress = getBillProgress(expense, year, month);
      // Variable months keep their own amount. A fixed expense's paid month records what it cost, so a later
      // edit doesn't rewrite paid history.
      const amount =
        details.amount !== undefined
          ? details.amount
          : progress.paid > 0 && progress.left != null
            ? progress.left
            : expense.isVariable
              ? previous.amount
              : expense.amount;
      const paidAt = details.paidAt ?? new Date().toISOString();
      const cost = progress.paid === 0 && amount == null ? null : round(progress.paid + (amount ?? 0), 2);
      return writeMonthPayments(
        expense,
        year,
        month,
        { status: "paid", amount: cost, paidAt },
        withNewPayment(expense, year, month, amount, { paidAt, accountId: details.accountId })
      );
    }
  );

  const payPart = useMemoizedFn(
    async (id: string, year: number, month: number, details: PayDetails & { amount: number }): Promise<UndoMonth> => {
      const expense = recurringExpense(id);
      const progress = getBillProgress(expense, year, month);
      if (!canPayPart(progress, details.amount)) {
        throw new BillPaymentError("That covers the bill. Use Mark as paid.");
      }
      const paidAt = details.paidAt ?? new Date().toISOString();
      return writeMonthPayments(
        expense,
        year,
        month,
        { status: "unpaid", amount: progress.bill, paidAt: null },
        withNewPayment(expense, year, month, details.amount, { paidAt, accountId: details.accountId })
      );
    }
  );

  const updatePayment = useMemoizedFn(
    async (paymentId: string, details: { amount: number; paidAt: string; accountId: string }): Promise<UndoMonth> => {
      const { expense, year, month } = paymentMonth(paymentId);
      if (!(details.amount > 0)) {
        throw new Error("Payment must be at least 0.01");
      }
      const previous = monthStateOf(expense.id, year, month);
      const rows = accounts.getPayments(expense.id, year, month);
      const others = rows.filter((t) => t.id !== paymentId);
      const payments = rows.map((t) =>
        t.id === paymentId
          ? { accountId: details.accountId, amount: details.amount, note: t.note ?? paymentNote(expense), createdAt: details.paidAt }
          : paymentInputOf(t, expense)
      );
      if (previous.status !== "paid") {
        const progress = billProgress({
          bill: getDisplayAmount(expense, year, month),
          payments: others.map((t) => Math.abs(t.amount)),
          isPaid: false,
        });
        if (!canPayPart(progress, details.amount)) {
          throw new BillPaymentError("That covers the bill. Use Mark as paid.");
        }
        return writeMonthPayments(expense, year, month, previous, payments);
      }
      const isSettlingRow = rows[rows.length - 1]?.id === paymentId;
      const paidAt = isSettlingRow
        ? latestDate([details.paidAt, ...others.map((t) => t.createdAt)])
        : latestDate(previous.paidAt != null ? [previous.paidAt, details.paidAt] : [details.paidAt]);
      return writeMonthPayments(
        expense,
        year,
        month,
        { status: "paid", amount: round(paidSum(others) + details.amount, 2), paidAt },
        payments
      );
    }
  );

  const revertPayment = useMemoizedFn(async (paymentId: string): Promise<UndoMonth> => {
    const { expense, year, month } = paymentMonth(paymentId);
    const previous = monthStateOf(expense.id, year, month);
    const others = accounts.getPayments(expense.id, year, month).filter((t) => t.id !== paymentId);
    // The month keeps its amount, so what's left is what was deleted; with no payments left a fixed month follows
    // the expense again.
    return reverseMonthPayments({
      expense,
      year,
      month,
      next: { status: "unpaid", amount: others.length === 0 && !expense.isVariable ? null : previous.amount, paidAt: null },
      paymentIds: [paymentId],
    });
  });

  const unpayMonth = useMemoizedFn(async (id: string, year: number, month: number): Promise<UndoMonth> => {
    const expense = recurringExpense(id);
    const previous = monthStateOf(id, year, month);
    // A fixed expense's month follows the expense again once unpaid; variable months keep their own amount.
    return reverseMonthPayments({
      expense,
      year,
      month,
      next: { status: "unpaid", amount: expense.isVariable ? previous.amount : null, paidAt: null },
      paymentIds: accounts.getPayments(id, year, month).map((t) => t.id),
    });
  });

  const toggleMonthStatus = useMemoizedFn(
    async (id: string, year: number, month: number): Promise<void> => {
      const expense = state.expenses.find((e) => e.id === id);
      if (!expense) {
        return;
      }

      if (expense.recurrence === "one-off") {
        const next: Status = expense.status === "unpaid" ? "paid" : "unpaid";
        await updateExpenseStatus(id, next);
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
              createdAt: expense.paidDate ?? undefined,
            });
          } else {
            await reverseOneOffPayment(id);
          }
        } catch (err) {
          console.error("Failed to sync payment, reverting status", err);
          await updateExpenseStatus(id, expense.status);
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
      await accounts.deletePayments(id, null, null);
    }
    await removeExpense(id);
    dispatch({ type: "REMOVE", payload: id });
  });

  const reloadAll = useMemoizedFn(async () => {
    const [rows, months, name, collapsedBands] = await Promise.all([
      getAllExpenses(),
      getAllMonths(),
      getPreference("user_name"),
      getPreference("homeCollapsedBands"),
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
      getBillProgress,
      resolveAmount,
      getMonthPaidAt,
      toggleMonthStatus,
      payMonth,
      payPart,
      updatePayment,
      revertPayment,
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
      getBillProgress,
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
