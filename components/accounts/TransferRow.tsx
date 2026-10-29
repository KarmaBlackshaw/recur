import React from "react";
import { router } from "expo-router";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/dateHelpers";
import type { TransferEntry } from "@/utils/usePaidLedger";

export function TransferRow({ entry }: { entry: TransferEntry }) {
  const { transfer, fromName, toName, amount, fee, earned, earnedCategory, earnedAccountName } = entry;
  const source = fromName ?? "Deleted account";
  const destination = toName ?? "Deleted account";
  const title = `${source} → ${destination}`;
  const isAutoNote = transfer.note === `Transfer to ${destination}` || transfer.note === `Transfer from ${source}`;
  const customNote = isAutoNote ? null : transfer.note;
  const earnedLabel =
    earned > 0
      ? [`income ${formatAmount(earned)}`, earnedAccountName && `to ${earnedAccountName}`, earnedCategory && `(${earnedCategory})`]
          .filter(Boolean)
          .join(" ")
      : null;
  const feeText = fee > 0 ? `fee ${formatAmount(fee)}` : null;
  const meta = [customNote, earnedLabel].filter(Boolean).join(" · ") || "Transfer";
  const details = [customNote, feeText, earnedLabel].filter(Boolean).join(", ") || "Transfer";
  const { transferId } = transfer;

  function open() {
    if (transferId) {
      router.push({ pathname: "/transfer", params: { id: transferId } });
      return;
    }
    router.push({ pathname: "/account/[id]", params: { id: transfer.accountId } });
  }

  return (
    <AppListRow
      icon="repeat"
      title={title}
      meta={meta}
      amount={formatAmount(amount)}
      amountTone="muted"
      caption={feeText ?? undefined}
      onPress={open}
      accessibilityLabel={`Transfer from ${source} to ${destination}, ${formatAmount(amount)}, ${details}`}
      accessibilityHint={transferId ? "Opens the transfer" : "Opens account details"}
    />
  );
}
