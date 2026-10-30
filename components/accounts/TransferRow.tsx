import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { customTransferNote } from "@/utils/accounts/customTransferNote";
import { formatAmount } from "@/utils/dateHelpers";
import type { TransferEntry } from "@/utils/usePaidLedger";

export function TransferRow({ entry, onPress }: { entry: TransferEntry; onPress: () => void }) {
  const { transfer, fromName, toName, amount, fee, earned, earnedCategory, earnedAccountName } = entry;
  const source = fromName ?? "Deleted account";
  const destination = toName ?? "Deleted account";
  const title = `${source} → ${destination}`;
  const customNote = customTransferNote(transfer.note, source, destination);
  const earnedLabel =
    earned > 0
      ? [`income ${formatAmount(earned)}`, earnedAccountName && `to ${earnedAccountName}`, earnedCategory && `(${earnedCategory})`]
          .filter(Boolean)
          .join(" ")
      : null;
  const feeText = fee > 0 ? `fee ${formatAmount(fee)}` : null;
  const meta = [customNote, earnedLabel].filter(Boolean).join(" · ") || "Transfer";
  const details = [customNote, feeText, earnedLabel].filter(Boolean).join(", ") || "Transfer";

  return (
    <AppListRow
      icon="repeat"
      title={title}
      meta={meta}
      amount={formatAmount(amount)}
      amountTone="muted"
      caption={feeText ?? undefined}
      onPress={onPress}
      accessibilityLabel={`Transfer from ${source} to ${destination}, ${formatAmount(amount)}, ${details}`}
      accessibilityHint="Opens transfer details"
    />
  );
}
