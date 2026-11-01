import React from "react";
import { View } from "react-native";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import { loanTitle } from "@/utils/loans/loanTitle";
import type { TLoanPaymentPart } from "@/utils/loans/splitLoanPayment";

interface Props {
  parts: TLoanPaymentPart[];
}

export function LoanSplitPreview({ parts }: Props) {
  return (
    <View className="mt-2 mb-3">
      <AppLabel>{`Split across ${parts.length} loans, oldest first`}</AppLabel>
      <View className="-mx-5">
        {parts.map(({ loan, share, balanceAfter, isSettled }) => {
          const title = loanTitle(loan);
          const amount = formatAmount(share);
          const caption = isSettled ? "Settled" : `${formatAmount(balanceAfter)} left`;
          const meta = loan.interest.type === "none" ? undefined : formatLoanInterest(loan.interest);
          return (
            <AppListRow
              key={loan.id}
              icon="user"
              iconTone="accent"
              title={title}
              meta={meta}
              amount={amount}
              caption={caption}
              isMuted={share < 0.01}
              accessibilityLabel={`${title}, ${amount} of this payment, ${caption}`}
            />
          );
        })}
      </View>
    </View>
  );
}
