import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { DELETED_ACCOUNT, NO_ACCOUNT } from "@/constants/accounts";
import { formatDaysLate, getDueDateForMonth, isOverdueOn } from "@/utils/dateHelpers";
import { expenseTitle } from "@/utils/expenseHelpers";
import { openExpense } from "@/utils/expenses/openExpense";
import { formatBillAmount } from "@/utils/expenses/formatBillAmount";
import { payFromAccountId } from "@/utils/accounts/payFromAccountId";
import type { PayOptions, PayTarget } from "@/components/PaySheet";

export interface BillSheetRef {
  present: (target: PayTarget) => void;
}

interface Props {
  onPay: (target: PayTarget, options: PayOptions) => void;
}

interface Snapshot {
  target: PayTarget;
  amountText: string;
  dueText: string;
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
  const accountSheetRef = useRef<AccountPickerSheetRef>(null);
  const { getDisplayAmount } = useExpenses();
  const { accounts, activeAccounts } = useAccounts();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [accountId, setAccountId] = useState<string | null>(null);

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
      });
      setAccountId(payFromAccountId(expense, activeAccounts));
      sheetRef.current?.present();
    },
  }));

  // A TBD bill asks for its amount in the Pay sheet, which keeps a way to the bill's page.
  function handlePay({ target }: Snapshot) {
    sheetRef.current?.dismiss(() =>
      onPay(target, { accountId, footer: (dismiss) => <DetailsButton target={target} dismiss={dismiss} /> })
    );
  }

  const accountName = accountId == null ? NO_ACCOUNT : accounts.find(({ id }) => id === accountId)?.name ?? DELETED_ACCOUNT;

  return (
    <>
      <AppBottomSheet
        ref={sheetRef}
        title={snapshot ? expenseTitle(snapshot.target.expense) : "Bill"}
        snapPoints={CONTENT_HEIGHT_SNAP}
      >
        {snapshot ? (
          <View className="px-4 pb-4">
            <AppDetailRow label="Amount" value={snapshot.amountText} />
            <AppDetailRow label="Due" value={snapshot.dueText} />
            <AppDetailRow label="Pay from" value={accountName} onPress={() => accountSheetRef.current?.present()} />
            <View className="mt-4 gap-2">
              <AppButton label="Pay" onPress={() => handlePay(snapshot)} />
              <DetailsButton target={snapshot.target} dismiss={() => sheetRef.current?.dismiss()} />
            </View>
          </View>
        ) : null}
      </AppBottomSheet>
      <AccountPickerSheet ref={accountSheetRef} value={accountId ?? ""} onChange={setAccountId} />
    </>
  );
});
