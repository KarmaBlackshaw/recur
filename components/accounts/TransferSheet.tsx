import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { router } from "expo-router";
import { useAccounts } from "@/context/AccountContext";
import { InfoRow } from "@/components/accounts/InfoRow";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { DELETED_ACCOUNT } from "@/constants/accounts";
import { customTransferNote } from "@/utils/accounts/customTransferNote";
import { splitTransfer } from "@/utils/accounts/splitTransfer";
import { useRevertTransfer } from "@/utils/accounts/useRevertTransfer";
import { formatAmount } from "@/utils/dateHelpers";
import type { AccountTransaction } from "@/types";

export interface TransferSheetRef {
  present: (transfer: AccountTransaction) => void;
}

export const TransferSheet = forwardRef<TransferSheetRef>(function TransferSheet(_props, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const accounts = useAccounts();
  const revertTransfer = useRevertTransfer();
  const [transferId, setTransferId] = useState<string>();

  useImperativeHandle(ref, () => ({
    present: (transfer) => {
      if (!transfer.transferId) {
        return;
      }
      setTransferId(transfer.transferId);
      sheetRef.current?.present();
    },
  }));

  const rows = transferId ? accounts.transactions.filter((t) => t.transferId === transferId) : [];
  const { from, to, fee, income, isBillPayment } = splitTransfer(rows, accounts.accounts);
  const side = from ?? to;
  const accountName = (accountId?: string) =>
    accounts.accounts.find(({ id }) => id === accountId)?.name ?? DELETED_ACCOUNT;
  const source = accountName(from?.accountId);
  const destination = accountName(to?.accountId);
  const note = side && customTransferNote(side.note, source, destination);
  const incomeAccount = income && income.accountId !== to?.accountId ? accountName(income.accountId) : null;
  const incomeValue = income && [formatAmount(income.amount), income.category, incomeAccount].filter(Boolean).join(" · ");

  function handleEdit() {
    if (transferId) {
      sheetRef.current?.dismiss();
      router.push({ pathname: "/transfer", params: { id: transferId } });
    }
  }

  function handleRevert() {
    if (transferId) {
      revertTransfer(transferId, (revert) => sheetRef.current?.dismiss(revert));
    }
  }

  return (
    <AppBottomSheet
      ref={sheetRef}
      title={isBillPayment ? "Bill payment" : "Transfer"}
      snapPoints={CONTENT_HEIGHT_SNAP}
    >
      {side ? (
        <View className="px-4 pb-4">
          <InfoRow label="From" value={source} />
          <InfoRow label="To" value={destination} />
          <InfoRow label="Amount" value={formatAmount(Math.abs(side.amount))} />
          {fee && <InfoRow label="Fee" value={formatAmount(Math.abs(fee.amount))} />}
          {incomeValue && <InfoRow label="Income" value={incomeValue} />}
          <InfoRow label="Date" value={dayjs(side.createdAt).format("MMM D, YYYY, h:mm A")} />
          {note && <InfoRow label="Note" value={note} />}
          <View className="mt-4 gap-2">
            <AppButton label={isBillPayment ? "Edit payment" : "Edit transfer"} variant="tonal" onPress={handleEdit} />
            <AppButton
              label={isBillPayment ? "Revert payment" : "Revert transfer"}
              variant="destructive"
              onPress={handleRevert}
            />
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  );
});
