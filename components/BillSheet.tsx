import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef, type SheetFooter } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { formatDaysLate, getDueDateForMonth, isOverdueOn } from "@/utils/dateHelpers";
import { expenseTitle } from "@/utils/expenseHelpers";
import { openExpense } from "@/utils/expenses/openExpense";
import { formatBillAmount } from "@/utils/expenses/formatBillAmount";
import type { PayTarget } from "@/components/PaySheet";

export interface BillSheetRef {
  present: (target: PayTarget) => void;
}

interface Props {
  onPay: (target: PayTarget, footer: SheetFooter) => void;
}

interface Snapshot {
  target: PayTarget;
  amountText: string;
  dueText: string;
  accountName?: string;
}

function DetailsButton({ target: { expense, year, month }, dismiss }: { target: PayTarget; dismiss: () => void }) {
  function handlePress() {
    dismiss();
    openExpense(expense, year, month);
  }

  return <AppButton label="Details" variant="tonal" onPress={handlePress} />;
}

export const BillSheet = forwardRef<BillSheetRef, Props>(function BillSheet({ onPay }, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const { getDisplayAmount } = useExpenses();
  const { accounts } = useAccounts();
  const [snapshot, setSnapshot] = useState<Snapshot>();

  useImperativeHandle(ref, () => ({
    present: (target) => {
      const { expense, year, month } = target;
      const amount = getDisplayAmount(expense, year, month);
      const due = getDueDateForMonth(expense.dueDay, year, month);
      const lateText = isOverdueOn(expense.dueDay, year, month) ? ` · ${formatDaysLate(due)}` : "";
      setSnapshot({
        target,
        amountText: formatBillAmount(amount),
        dueText: `${dayjs(due).format("MMM D")}${lateText}`,
        accountName: accounts.find(({ id }) => id === expense.accountId)?.name,
      });
      sheetRef.current?.present();
    },
  }));

  // A TBD bill asks for its amount in the Pay sheet, which keeps a way to the bill's page.
  function handlePay({ target }: Snapshot) {
    sheetRef.current?.dismiss(() => onPay(target, (dismiss) => <DetailsButton target={target} dismiss={dismiss} />));
  }

  return (
    <AppBottomSheet
      ref={sheetRef}
      title={snapshot ? expenseTitle(snapshot.target.expense) : "Bill"}
      snapPoints={CONTENT_HEIGHT_SNAP}
    >
      {snapshot ? (
        <View className="px-4 pb-4">
          <AppDetailRow label="Amount" value={snapshot.amountText} />
          <AppDetailRow label="Due" value={snapshot.dueText} />
          {snapshot.accountName ? <AppDetailRow label="Pay from" value={snapshot.accountName} /> : null}
          <View className="mt-4 gap-2">
            <AppButton label="Pay" onPress={() => handlePay(snapshot)} />
            <DetailsButton target={snapshot.target} dismiss={() => sheetRef.current?.dismiss()} />
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  );
});
