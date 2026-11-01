import type { IncomeEntry } from "@/utils/usePaidLedger";

export function incomeTitle({ income, loan }: Pick<IncomeEntry, "income" | "loan">) {
  const category = income.category ?? "Income";
  return loan ? `${category} from ${loan.borrower}` : category;
}
