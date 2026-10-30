import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { useAccounts } from "@/context/AccountContext";
import { InfoRow } from "@/components/accounts/InfoRow";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { customTransferNote } from "@/utils/accounts/customTransferNote";
import { splitTransfer } from "@/utils/accounts/splitTransfer";
import { useRevertTransfer } from "@/utils/accounts/useRevertTransfer";
import { formatAmount } from "@/utils/dateHelpers";
import type { AccountTransaction } from "@/types";

export interface TransferSheetRef {
  present: (transfer: AccountTransaction) => void;
}

export const TransferSheet = forwardRef<TransferSheetRef>(function TransferSheet(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const accounts = useAccounts();
  const revertTransfer = useRevertTransfer();
  // A snapshot: reverting deletes these rows while the sheet is still animating out.
  const [rows, setRows] = useState<AccountTransaction[]>([]);

  useImperativeHandle(ref, () => ({
    present: ({ transferId }) => {
      if (!transferId) {
        return;
      }
      setRows(accounts.transactions.filter((t) => t.transferId === transferId));
      sheetRef.current?.present();
    },
  }));

  const { from, to, fee, income, isBillPayment } = splitTransfer(rows, accounts.accounts);
  const side = from ?? to;
  const accountName = (accountId?: string) =>
    accounts.accounts.find(({ id }) => id === accountId)?.name ?? "Deleted account";
  const source = accountName(from?.accountId);
  const destination = accountName(to?.accountId);
  const note = side && customTransferNote(side.note, source, destination);
  const incomeAccount = income && income.accountId !== to?.accountId ? accountName(income.accountId) : null;
  const incomeValue = income && [formatAmount(income.amount), income.category, incomeAccount].filter(Boolean).join(" · ");

  function handleRevert() {
    const transferId = side?.transferId;
    if (transferId) {
      revertTransfer(transferId, () => sheetRef.current?.dismiss());
    }
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="px-5 pb-10">
        {side ? (
          <>
            <View className="flex-row items-center justify-between mb-2">
              <AppText variant="title" accessibilityRole="header">{isBillPayment ? "Bill payment" : "Transfer"}</AppText>
              <TouchableOpacity
                className="w-11 h-11 items-center justify-center"
                onPress={() => sheetRef.current?.dismiss()}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <InfoRow label="From" value={source} />
            <InfoRow label="To" value={destination} />
            <InfoRow label="Amount" value={formatAmount(Math.abs(side.amount))} />
            {fee && <InfoRow label="Fee" value={formatAmount(Math.abs(fee.amount))} />}
            {incomeValue && <InfoRow label="Income" value={incomeValue} />}
            <InfoRow label="Date" value={dayjs(side.createdAt).format("MMM D, YYYY, h:mm A")} />
            {note && <InfoRow label="Note" value={note} />}
            <AppButton
              label={isBillPayment ? "Revert payment" : "Revert transfer"}
              variant="destructive"
              onPress={handleRevert}
              className="mt-4"
            />
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
