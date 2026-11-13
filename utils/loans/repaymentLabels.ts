import { DELETED_ACCOUNT } from "@/constants/accounts";
import { countLabel } from "@/utils/countLabel";
import { formatAmount } from "@/utils/formatAmount";
import type { TRepayment } from "@/types";

export function repaymentLabels(
  { payments, settledCount, excess, accountIds }: TRepayment,
  accountName: (id: string) => string | undefined
): {
  account: string;
  loans: string;
  settled: string | null;
  settledLead: string | null;
  extra: string | null;
} {
  const [firstAccountId] = accountIds;
  const isSingle = payments.length === 1;
  const hasSettled = settledCount > 0;
  const settledCountLabel = `${settledCount} settled`;
  return {
    account:
      accountIds.length === 1
        ? (accountName(firstAccountId) ?? DELETED_ACCOUNT)
        : countLabel(accountIds.length, "account", "accounts"),
    loans: countLabel(payments.length, "loan", "loans"),
    settled: !hasSettled ? null : isSingle ? "settled" : settledCountLabel,
    settledLead: !hasSettled ? null : isSingle ? "Settled" : settledCountLabel,
    extra: excess ? `+${formatAmount(excess.amount)} extra` : null,
  };
}
