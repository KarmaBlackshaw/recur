import React from "react";
import { Image, View } from "react-native";
import { Ionicon } from "@/components/ui/Ionicon";
import { resolveAccountLogo } from "@/utils/accountLogo/resolveAccountLogo";
import { colors } from "@/constants/theme";
import { findBank } from "@/constants/banks";
import type { Account, AccountType, IoniconName } from "@/types";

const TYPE_ICON: Record<AccountType, IoniconName> = {
  debit: "wallet-outline",
  cash: "cash-outline",
  credit: "card-outline",
};

export function AccountLogo({ account }: { account: Account }) {
  const bank = findBank(account.bank);

  if (account.logoUri) {
    return <Image source={{ uri: resolveAccountLogo(account.logoUri) }} className="size-9 rounded-xl bg-white" />;
  }
  if (bank) {
    return (
      <View className="size-9 rounded-xl items-center justify-center bg-white">
        <Image source={bank.logo} className="size-[24px]" />
      </View>
    );
  }
  return (
    <View className="size-9 rounded-xl items-center justify-center bg-white/20">
      <Ionicon name={account.icon ?? TYPE_ICON[account.type]} size={18} color={colors.text} />
    </View>
  );
}
