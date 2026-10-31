import { expenseTitle } from "@/utils/expenseHelpers";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

export interface ActivitySearchContext {
  accountName: (id: string | null | undefined) => string | undefined;
}

// What a row shows (plus its kind), so a search finds it by name, category, account, person or keyword.
function searchableText(entry: ActivityEntry, { accountName }: ActivitySearchContext): (string | null | undefined)[] {
  if ("expense" in entry) {
    const { expense } = entry;
    return [expenseTitle(expense), expense.category, accountName(expense.accountId)];
  }
  if ("income" in entry) {
    const { income } = entry;
    return ["income", income.category, income.note, accountName(income.accountId)];
  }
  if ("interest" in entry) {
    return ["interest", entry.accountName ?? accountName(entry.interest.accountId)];
  }
  if ("transfer" in entry) {
    return ["transfer", entry.fromName, entry.toName, entry.transfer.note, entry.earnedCategory, entry.earnedAccountName];
  }
  if ("loanTxn" in entry) {
    const { loanTxn, loan } = entry;
    const borrower = loan?.borrower;
    const title = borrower == null ? null : loanTxn.kind === "loan_in" ? `${borrower} repaid` : `Lent to ${borrower}`;
    return [title, "loan", accountName(loanTxn.accountId)];
  }
  return [`${entry.account.name} bill`, entry.sourceName];
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
