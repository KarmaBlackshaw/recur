import dayjs from "dayjs";
import { groupBy, keyBy, maxBy, orderBy, uniq } from "@/utils/collections";
import { round } from "@/utils/round";
import type { TLoanSummary } from "@/utils/loans/summarizeLoan";
import type { AccountTransaction, Loan, TRepayment, TRepaymentPayment } from "@/types";

const time = (value: string) => dayjs(value).valueOf();

export function groupRepayments({ transactions, loans, summaries }: {
  transactions: readonly AccountTransaction[];
  loans: readonly Loan[];
  summaries: Record<string, TLoanSummary<AccountTransaction>>;
}): TRepayment[] {
  const loansById: Record<string, Loan | undefined> = keyBy(loans, "id");
  const groups = groupBy(
    transactions.filter(({ kind }) => kind === "loan_in"),
    ({ repaymentId, id }) => repaymentId ?? id
  );
  const excessRows = orderBy(
    transactions.filter(
      ({ kind, repaymentId, loanId, transferId }) =>
        kind === "income" && repaymentId != null && loanId != null && transferId == null
    ),
    [({ createdAt }) => time(createdAt), "id"]
  );

  const repayments = Object.entries(groups).map(([id, rows]): TRepayment => {
    const payments = orderBy(
      rows.map((txn): TRepaymentPayment => {
        const loan = txn.loanId == null ? undefined : loansById[txn.loanId];
        return { txn, loan, isSettling: txn.loanId != null && summaries[txn.loanId]?.settledBy?.id === txn.id };
      }),
      [({ loan }) => (loan == null ? undefined : time(loan.lentAt)), ({ txn }) => time(txn.createdAt), ({ txn }) => txn.id]
    );
    const [first] = payments;
    const latest = maxBy(payments, ({ txn }) => time(txn.createdAt)) ?? first;
    const excess = excessRows.find(({ repaymentId }) => repaymentId === id);
    const principal = round(payments.reduce((sum, { txn }) => sum + txn.amount, 0), 2);
    return {
      id,
      borrower: first.loan?.borrower,
      payments,
      excess,
      principal,
      total: round(principal + (excess?.amount ?? 0), 2),
      settledCount: payments.filter(({ isSettling }) => isSettling).length,
      paidAt: latest.txn.createdAt,
      accountIds: uniq([...payments.map(({ txn }) => txn.accountId), ...(excess ? [excess.accountId] : [])]),
    };
  });

  return orderBy(repayments, [({ paidAt }) => time(paidAt), "id"], ["desc", "desc"]);
}
