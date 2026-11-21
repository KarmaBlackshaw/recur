import { countLabel } from "@/utils/countLabel";
import type { CategoryKind } from "@/types";

export function categoryUsesLabel(kind: CategoryKind, uses: number) {
  return kind === "income"
    ? countLabel(uses, "income entry", "income entries")
    : countLabel(uses, "expense", "expenses");
}
