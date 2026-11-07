import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import type { PayTarget } from "@/components/PaySheet";
import { AccountLogo } from "@/components/accounts/AccountLogo";
import { AppConfirmSheet, type AppConfirmSheetRef } from "@/components/ui/AppConfirmSheet";
import { AppHeroCard } from "@/components/ui/AppHeroCard";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { DELETED_ACCOUNT } from "@/constants/accounts";
import { DEFAULT_CARD_COLOR } from "@/constants/cardColors";
import { colors } from "@/constants/theme";
import { payFromAccountId } from "@/utils/accounts/payFromAccountId";
import { formatDaysLate, getDueDateForMonth, isOverdueOn } from "@/utils/dateHelpers";
import { expenseTitle } from "@/utils/expenseHelpers";
import { formatAmount } from "@/utils/formatAmount";

export interface PayConfirmSheetRef {
  ask: (target: PayTarget) => Promise<boolean>;
}

export const PayConfirmSheet = forwardRef<PayConfirmSheetRef>(function PayConfirmSheet(_props, ref) {
  const confirmRef = useRef<AppConfirmSheetRef>(null);
  const [target, setTarget] = useState<PayTarget | null>(null);
  const { getBillProgress } = useExpenses();
  const { accounts, activeAccounts } = useAccounts();

  useImperativeHandle(ref, () => ({
    ask: (next) => {
      setTarget(next);
      return confirmRef.current?.ask() ?? Promise.resolve(false);
    },
  }));

  const title = target ? `Mark ${expenseTitle(target.expense)} paid?` : "Mark paid?";

  function renderBody({ expense, year, month }: PayTarget) {
    const { bill, paid, left } = getBillProgress(expense, year, month);
    const amount = paid > 0 && left != null ? left : (bill ?? 0);
    const monthName = dayjs(new Date(year, month, 1)).format("MMMM");
    const dueDate = getDueDateForMonth(expense.dueDay, year, month);
    const dueText = isOverdueOn(expense.dueDay, year, month)
      ? formatDaysLate(dueDate)
      : `due ${dayjs(dueDate).format("MMM D")}`;
    const accountId = payFromAccountId(expense, activeAccounts);
    const account = accounts.find(({ id }) => id === accountId);
    const accountName = account?.name ?? DELETED_ACCOUNT;

    const footer =
      amount > 0 ? (
        <View
          className="flex-row items-center gap-3 border-t border-border px-5 py-3"
          accessible
          accessibilityLabel={`Pay from ${accountName}`}
        >
          {account ? (
            <View className="rounded-xl" style={{ backgroundColor: account.color ?? DEFAULT_CARD_COLOR }}>
              <AccountLogo account={account} />
            </View>
          ) : (
            <View className="size-9 rounded-xl items-center justify-center bg-white/[0.04]">
              <Feather name="slash" size={18} color={colors.textMuted} />
            </View>
          )}
          <View className="flex-1">
            <AppText variant="label">Pay from</AppText>
            <AppText variant="body-bold" numberOfLines={1}>{accountName}</AppText>
          </View>
        </View>
      ) : undefined;

    return (
      <>
        <AppText variant="meta" className="-mt-2 mb-3">{`${monthName} bill · ${dueText}`}</AppText>
        <AppHeroCard
          tone="neutral"
          overline={paid > 0 ? "Left to pay" : "Amount"}
          value={formatAmount(amount)}
          footer={footer}
        >
          {paid > 0 && amount > 0 && (
            <AppText variant="meta" className="mt-1">{`${formatAmount(paid)} paid so far`}</AppText>
          )}
          {amount === 0 && (
            <AppText variant="meta" className="mt-1">
              {paid > 0 ? `Nothing is left to pay for ${monthName}.` : `${monthName} has no bill, so no money leaves an account.`}
            </AppText>
          )}
        </AppHeroCard>
      </>
    );
  }

  return (
    <AppConfirmSheet ref={confirmRef} title={title} confirmLabel="Mark paid">
      {target && renderBody(target)}
    </AppConfirmSheet>
  );
});
