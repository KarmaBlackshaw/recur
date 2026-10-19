import React, { useMemo } from "react";
import { SectionList, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { DayHeaderRow } from "@/components/DayHeaderRow";
import { AppText } from "@/components/ui/AppText";
import { useAccounts } from "@/context/AccountContext";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { groupEntriesByDay } from "@/utils/groupEntriesByDay";
import type { AccountTransaction } from "@/types";

interface Props {
  entries: AccountTransaction[];
  ListEmptyComponent?: React.ComponentProps<typeof SectionList>["ListEmptyComponent"];
}

function IncomeRow({ transaction, accountName }: { transaction: AccountTransaction; accountName: string }) {
  const title = transaction.category ?? "Income";
  const subtitle = [accountName, transaction.note].filter(Boolean).join(" · ");
  const signed = `+${formatAmount(transaction.amount)}`;

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 px-5 py-3 min-h-[60px]"
      onPress={() => router.push({ pathname: "/income/add", params: { id: transaction.id } })}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${signed}, ${subtitle}`}
      accessibilityHint="Edits this income"
    >
      <View className="w-9 h-9 rounded-xl bg-white/[0.07] items-center justify-center">
        <Feather name="arrow-down-left" size={16} color={colors.textSecondary} />
      </View>
      <View className="flex-1">
        <AppText variant="body-bold" className="text-sm">{title}</AppText>
        <AppText variant="meta" className="text-textMuted" numberOfLines={1}>{subtitle}</AppText>
      </View>
      <AppText variant="amount" className="text-[15px] text-paid">
        {signed}
      </AppText>
    </TouchableOpacity>
  );
}

export function IncomeList({ entries, ListEmptyComponent }: Props) {
  const { accounts } = useAccounts();

  const sections = useMemo(
    () =>
      groupEntriesByDay(
        entries.map((t) => ({ key: t.id, effDate: new Date(t.createdAt), amount: t.amount, transaction: t }))
      ),
    [entries]
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.key}
      ListEmptyComponent={ListEmptyComponent}
      renderItem={({ item }) => (
        <IncomeRow
          transaction={item.transaction}
          accountName={accounts.find(({ id }) => id === item.transaction.accountId)?.name ?? ""}
        />
      )}
      renderSectionHeader={({ section }) => <DayHeaderRow date={section.date} total={section.total} />}
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-[140px]"
      showsVerticalScrollIndicator={false}
    />
  );
}
