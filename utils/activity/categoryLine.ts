import { INTEREST_CATEGORY } from "@/constants/categories";
import { sumBy } from "@/utils/collections";
import { categoryIcon } from "@/utils/categories";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { MoneyFlow } from "@/types";
import { categoryBreakdown, type TCategoryLine } from "@/utils/stats/categoryBreakdown";

const FEES_CATEGORY = "Fees";
const UNCATEGORIZED_INCOME = "Other";

function line(category: string, amount: number, iconCategory = category): TCategoryLine {
  return { category, icon: categoryIcon(iconCategory), amount };
}

// Card charges count on the day they were charged, so a bill payment adds only its fee: it settles what's already
// counted. Loans add nothing: lent money is still yours (net worth counts it).
function expenseLine(entry: ActivityEntry): TCategoryLine | null {
  switch (entry.kind) {
    case "expense":
      return line(entry.expense.category, entry.amount);
    case "billPayment":
    case "transfer":
      return line(FEES_CATEGORY, entry.fee);
    case "income":
    case "interest":
    case "loan":
      return null;
  }
}

// Loan repayments add nothing either: getting lent money back isn't earning it. Income a loan brought in gets its
// own category, so a loan's income never reads as bank interest.
function incomeLine(entry: ActivityEntry): TCategoryLine | null {
  switch (entry.kind) {
    case "income": {
      const category = entry.income.category ?? UNCATEGORIZED_INCOME;
      return line(entry.loan ? `${category} from loans` : category, entry.amount, category);
    }
    case "interest":
      return line(INTEREST_CATEGORY, entry.amount);
    case "transfer":
      return line(entry.earnedCategory ?? UNCATEGORIZED_INCOME, entry.earned);
    case "expense":
    case "billPayment":
    case "loan":
      return null;
  }
}

// What an Activity row adds to one Stats category, or null when it adds nothing. Stats and Activity's category
// filter both read it, so a category's rows in Activity always add up to its Stats slice.
export function categoryLine(entry: ActivityEntry, flow: MoneyFlow): TCategoryLine | null {
  const result = flow === "income" ? incomeLine(entry) : expenseLine(entry);
  return result != null && result.amount > 0 ? result : null;
}

// The rows that make up one Stats slice, and what they add to it: Activity's category filter lists these.
export function categorySlice(entries: readonly ActivityEntry[], flow: MoneyFlow, category: string) {
  const matches = entries.filter((entry) => categoryLine(entry, flow)?.category === category);
  return { entries: matches, total: sumBy(matches, (entry) => categoryLine(entry, flow)?.amount ?? 0) };
}

// Every category the rows add to, biggest first: Stats' slices, and the choices in Activity's category filter.
export function categoryRows(entries: readonly ActivityEntry[], flow: MoneyFlow) {
  return categoryBreakdown(entries.flatMap((entry) => categoryLine(entry, flow) ?? []));
}
