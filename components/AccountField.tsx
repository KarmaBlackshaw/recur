import React, { useRef } from "react";
import { useAccounts } from "@/context/AccountContext";
import { AccountPickerSheet, type AccountPickerSheetRef } from "@/components/AccountPickerSheet";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { formatAmount } from "@/utils/formatAmount";
import type { Account } from "@/types";

interface AccountFieldProps {
  label: string;
  options: Account[];
  value: string;
  onChange: (id: string) => void;
}

export function AccountField({ label, options, value, onChange }: AccountFieldProps) {
  const { accounts, getBalance } = useAccounts();
  const pickerRef = useRef<AccountPickerSheetRef>(null);
  // Looked up across every account so an archived one on an existing transfer still shows by name.
  const selected = accounts.find((account) => account.id === value);
  return (
    <>
      <AppSelectField
        label={label}
        value={selected?.name ?? ""}
        placeholder="Choose account"
        onPress={() => pickerRef.current?.present()}
        accessibilityLabel={selected ? `${label}, ${selected.name}, ${formatAmount(getBalance(selected.id))}` : `${label}, choose account`}
      />
      <AccountPickerSheet ref={pickerRef} title={label} options={options} value={value} onChange={onChange} />
    </>
  );
}
