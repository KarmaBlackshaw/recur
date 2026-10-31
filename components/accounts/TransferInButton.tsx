import React from "react";
import { AppButton } from "@/components/ui/AppButton";
import { formatAmount } from "@/utils/dateHelpers";
import { transferIn } from "@/utils/accounts/transferIn";
import type { OverdraftError } from "@/utils/accounts/OverdraftError";

interface TransferInButtonProps {
  fieldError: string | undefined;
  overdraft: OverdraftError | undefined;
}

export function TransferInButton({ fieldError, overdraft }: TransferInButtonProps) {
  if (!overdraft || overdraft.message !== fieldError || overdraft.account.archivedAt) {
    return null;
  }
  return (
    <AppButton
      label="Transfer in"
      variant="tonal"
      size="sm"
      className="self-start mb-2"
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityLabel={`Transfer ${formatAmount(overdraft.shortfall)} into ${overdraft.account.name}`}
      onPress={() => transferIn(overdraft)}
    />
  );
}
