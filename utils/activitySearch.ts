import { expenseTitle } from "@/utils/expenseHelpers";
import { incomeTitle } from "@/utils/accounts/incomeTitle";
import { repaidTitle } from "@/utils/loans/repaidTitle";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

export interface ActivitySearchContext {
  accountName: (id: string | null | undefined) => string | undefined;
}

// What a row shows (plus its kind and note), so a search finds it by name, category, account, person, note or keyword.
function searchableText(entry: ActivityEntry, { accountName }: ActivitySearchContext): (string | null | undefined)[] {
  switch (entry.kind) {
    case "expense": {
      const { expense } = entry;
      return [expenseTitle(expense), expense.category, accountName(expense.accountId)];
    }
    case "income": {
      const { income, loan } = entry;
      return [incomeTitle(entry), "income", loan && "loan", income.category, income.note, accountName(income.accountId)];
    }
    case "interest":
      return ["interest", entry.accountName ?? accountName(entry.interest.accountId)];
    case "transfer":
      return ["transfer", entry.fromName, entry.toName, entry.transfer.note, entry.earnedCategory, entry.earnedAccountName];
    case "loan": {
      const { loanTxn, loan } = entry;
      const borrower = loan?.borrower;
      const title = borrower == null ? null : `Lent to ${borrower}`;
      return [title, "loan", loan?.note, accountName(loanTxn.accountId)];
    }
    case "repayment": {
      const { repayment, excess } = entry;
      const { borrower } = repayment;
      return [
        borrower == null ? null : repaidTitle(borrower),
        "loan",
        ...repayment.accountIds.map(accountName),
        excess?.income.category,
        ...repayment.payments.map(({ txn }) => txn.amount.toFixed(2)),
      ];
    }
    case "billPayment":
      return [`${entry.account.name} bill`, entry.sourceName, entry.payment.note];
  }
}

export function matchesActivity(entry: ActivityEntry, query: string, ctx: ActivitySearchContext): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return true;
  }
  const haystack = [...searchableText(entry, ctx), String(entry.amount), entry.amount.toFixed(2)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  // A formatted amount ("₱1,234.50", "1,234") finds the row through its bare digits. Matching those against
  // toFixed(2) covers every formatAmount substring without running Intl per row on each keystroke.
  const bare = q.replace(/[,₱]/g, "").trim();
  return haystack.includes(q) || (bare !== "" && haystack.includes(bare));
}
