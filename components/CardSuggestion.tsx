import React, { useMemo } from "react";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { useAccounts } from "@/context/AccountContext";
import { suggestCard } from "@/utils/accounts/suggestCard";
import { countLabel } from "@/utils/countLabel";
import { formatShortDate } from "@/utils/dates/formatShortDate";

// Home's "Use today" line: the credit card a purchase made today gets the most days on before its bill is due.
export function CardSuggestion({ today }: { today: Date }) {
  const { activeAccounts, getBalance, transactions } = useAccounts();

  // getBalance keeps its identity, so `transactions` re-ranks the cards when a balance changes.
  const suggestion = useMemo(
    () => suggestCard({ accounts: activeAccounts, getBalance, today }),
    [activeAccounts, getBalance, transactions, today]
  );

  if (suggestion == null) {
    return null;
  }

  const { account, dueDate, days } = suggestion;
  const due = days === 0 ? "due today" : `due ${formatShortDate(dueDate)} (${countLabel(days, "day", "days")})`;
  const spokenDue =
    days === 0 ? "due today" : `due ${dayjs(dueDate).format("MMMM D")}, in ${countLabel(days, "day", "days")}`;
  // Non-breaking spaces keep the due part whole, so a long line wraps after the "·" instead of cutting the days.
  const dueLine = `\u00A0· ${due.replace(/ /g, "\u00A0")}`;

  return (
    <TouchableOpacity
      testID="card-suggestion"
      className="mx-5 mt-3 min-h-[44px] flex-row items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-2.5"
      onPress={() => router.push({ pathname: "/account/[id]", params: { id: account.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Use today: ${account.name}, ${spokenDue}`}
      accessibilityHint="Opens the card"
    >
      <Feather name="credit-card" size={16} color={colors.secondary} />
      <AppText variant="meta" className="flex-1 text-[13px]" numberOfLines={2}>
        {"Use today: "}
        <AppText variant="body-bold" className="text-[13px]">
          {account.name}
        </AppText>
        {dueLine}
      </AppText>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}
