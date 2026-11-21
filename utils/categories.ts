import { LOCKED_INCOME_CATEGORIES } from "@/constants/categories";
import { maxBy, partition, sortBy } from "@/utils/collections";
import type { CategoryKind, FeatherIconName } from "@/types";

export const PRESET_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Subscriptions",
  "Transport",
  "Food",
  "Health",
  "Entertainment",
  "Education",
  "Savings",
  "Debt",
  "Other",
] as const;

export function isLockedCategory(name: string, kind: CategoryKind) {
  return kind === "income" && LOCKED_INCOME_CATEGORIES.includes(name);
}

export function lockedLast<T extends string | { name: string }>(categories: readonly T[], kind: CategoryKind): T[] {
  const nameOf = (category: T) => (typeof category === "string" ? category : category.name);
  const [locked, rest] = partition(categories, (category) => isLockedCategory(nameOf(category), kind));
  return [...rest, ...sortBy(locked, (category) => LOCKED_INCOME_CATEGORIES.indexOf(nameOf(category)))];
}

interface CategoryRow {
  id: number;
  name: string;
}

export interface ManageSnapshot {
  newestId: number;
  picked?: CategoryRow;
}

// Taken as a form opens Manage categories. A new row gets max rowid + 1 and a rename keeps its rowid.
export function snapshotBeforeManage(rows: readonly CategoryRow[], picked: string): ManageSnapshot {
  return { newestId: maxBy(rows, "id")?.id ?? 0, picked: rows.find((row) => row.name === picked) };
}

// The form's category once Manage closes: a category created there, the picked one's new name, or "" when the
// picked one was deleted, so the form asks again. Undefined keeps what the form has.
export function categoryAfterManage(before: ManageSnapshot, rows: readonly CategoryRow[]): string | undefined {
  const newest = maxBy(rows, "id");
  if (newest && newest.id > before.newestId) {
    return newest.name;
  }
  if (!before.picked) {
    return undefined;
  }
  const pickedId = before.picked.id;
  const picked = rows.find((row) => row.id === pickedId);
  if (!picked) {
    return "";
  }
  return picked.name === before.picked.name ? undefined : picked.name;
}

// Row glyphs for the preset expense + income categories. Custom or renamed categories
// fall back, so a row always says what the money was for instead of repeating a status glyph.
const CATEGORY_ICON: Partial<Record<string, FeatherIconName>> = {
  Housing: "home",
  Utilities: "zap",
  Insurance: "shield",
  Subscriptions: "play-circle",
  Transport: "navigation",
  Food: "coffee",
  Health: "heart",
  Entertainment: "film",
  Education: "book-open",
  Savings: "pocket",
  Debt: "trending-down",
  Salary: "briefcase",
  Freelance: "pen-tool",
  Business: "bar-chart-2",
  Gift: "gift",
  Refund: "rotate-ccw",
  Interest: "trending-up",
  Overpayment: "plus-circle",
  Transfer: "repeat",
  Fees: "scissors",
};

export function categoryIcon(category: string | null | undefined, fallback: FeatherIconName = "tag"): FeatherIconName {
  return (category ? CATEGORY_ICON[category] : undefined) ?? fallback;
}
