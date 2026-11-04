import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppText } from "@/components/ui/AppText";
import { AppUnderlineTabs, type TUnderlineTab } from "@/components/ui/AppUnderlineTabs";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import { categoryRows } from "@/utils/activity/categoryLine";
import { sumBy } from "@/utils/collections";
import { formatAmount } from "@/utils/formatAmount";
import type { MoneyFlow } from "@/types";

export interface CategoryFilterSheetRef {
  present: () => void;
}

interface CategoryFilterSheetProps {
  // The period's Activity rows: the sheet offers the categories they add to, like Stats' slices.
  entries: ActivityEntry[];
  category?: string;
  // The tab the sheet opens on.
  flow: MoneyFlow;
  periodLabel: string;
  onSelect: (category: string, flow: MoneyFlow) => void;
}

const EMPTY_MESSAGE: Record<MoneyFlow, string> = {
  expenses: "Nothing spent in",
  income: "No income in",
};

// Mounts with each opening (gorhom mounts a modal's content on present), so it always starts on the opener's tab.
function CategoryOptions({ entries, category, flow, periodLabel, onSelect }: CategoryFilterSheetProps) {
  const [tab, setTab] = useState(flow);
  const { expenseRows, incomeRows } = useMemo(
    () => ({ expenseRows: categoryRows(entries, "expenses"), incomeRows: categoryRows(entries, "income") }),
    [entries]
  );
  const rows = tab === "income" ? incomeRows : expenseRows;
  const tabs: TUnderlineTab<MoneyFlow>[] = [
    { label: "Income", detail: formatAmount(sumBy(incomeRows, "amount")), value: "income" },
    { label: "Expenses", detail: formatAmount(sumBy(expenseRows, "amount")), value: "expenses" },
  ];

  return (
    <>
      <AppUnderlineTabs tabs={tabs} value={tab} onChange={setTab} />
      {rows.length === 0 ? (
        <AppText variant="meta" className="px-4 mt-3 mb-3">
          {`${EMPTY_MESSAGE[tab]} ${periodLabel}`}
        </AppText>
      ) : (
        <AppRadioGroup
          options={rows.map((row) => ({ label: row.category, value: row.category }))}
          value={tab === flow ? (category ?? "") : ""}
          onChange={(next) => onSelect(next, tab)}
          className="px-4 mb-3"
        />
      )}
    </>
  );
}

// Picks the category Activity narrows to, from the ones the period's rows add to.
export const CategoryFilterSheet = forwardRef<CategoryFilterSheetRef, CategoryFilterSheetProps>(function CategoryFilterSheet(
  { onSelect, ...props },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  // The filter changes what Activity shows, so it applies once the sheet has closed.
  function select(category: string, flow: MoneyFlow) {
    sheetRef.current?.dismiss(() => onSelect(category, flow));
  }

  return (
    <AppBottomSheet ref={sheetRef} title="Category" snapPoints={CONTENT_HEIGHT_SNAP} scrollable>
      <CategoryOptions {...props} onSelect={select} />
    </AppBottomSheet>
  );
});
