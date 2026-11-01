import { OVERPAYMENT_CATEGORY } from "@/constants/categories";
import { partition } from "@/utils/collections";
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
  return kind === "income" && name === OVERPAYMENT_CATEGORY;
}

export function lockedLast<T extends string | { name: string }>(categories: readonly T[], kind: CategoryKind): T[] {
  const [locked, rest] = partition(categories, (category) =>
    isLockedCategory(typeof category === "string" ? category : category.name, kind)
  );
  return [...rest, ...locked];
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
  Fees: "scissors",
};

export function categoryIcon(category: string | null | undefined, fallback: FeatherIconName = "tag"): FeatherIconName {
  return (category ? CATEGORY_ICON[category] : undefined) ?? fallback;
}
