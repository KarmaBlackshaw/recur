import React, { useMemo } from "react";
import { SectionList, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { sumBy, orderBy, partition } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFab } from "@/components/ui/AppFab";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoanRow } from "@/components/loans/LoanRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { Loan } from "@/types";

// The header already names the borrower, so rows say which loan: its note, else what was lent and when.
function loanTitle({ note, principal, lentAt }: Loan) {
  return note?.trim() || `${formatAmount(principal)} · ${dayjs(lentAt).format("MMM D")}`;
}

export default function BorrowerLoansScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const loans = useLoans();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const insets = useSafeAreaInsets();
  const today = dayjs().format("YYYY-MM-DD");

  const { active, settled } = useMemo(() => {
    const own = loans.loans.filter(({ borrower }) => borrower === name);
    const [settledLoans, activeLoans] = partition(own, ({ id }) => loans.summaries[id]?.isSettled === true);
    return {
      active: orderBy(activeLoans, "lentAt", "asc"),
      settled: orderBy(settledLoans, ({ id }) => loans.summaries[id]?.settledAt ?? "", "desc"),
    };
  }, [loans.loans, loans.summaries, name]);

  if (accounts.isLoading || loans.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (active.length + settled.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">No loans for this person.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const isAllSettled = active.length === 0;
  const heroAmount = isAllSettled
    ? sumBy(settled, ({ id }) => loans.summaries[id]?.paidTotal ?? 0)
    : sumBy(active, ({ id }) => loans.summaries[id]?.balance ?? 0);
  const hero = isAllSettled
    ? { overline: "Collected", box: "bg-paid/10 border-paid/20", amount: "text-paid" }
    : { overline: "Owes you", box: "bg-secondary/10 border-secondary/20", amount: "text-secondary" };
  const meta = `${active.length} active · ${settled.length} settled`;
  const sections = [
    { title: "Active", data: active },
    { title: "Settled", data: settled },
  ].filter(({ data }) => data.length > 0);

  function recordPayment() {
    if (active.length === 1) {
      router.push({ pathname: "/loan/pay", params: { id: active[0].id } });
      return;
    }
    router.push({ pathname: "/loan/pay", params: { borrower: name } });
  }

  function renderItem({ item }: { item: Loan }) {
    const summary = loans.summaries[item.id];
    if (!summary) {
      return null;
    }
    return (
      <LoanRow
        loan={item}
        summary={summary}
        accountName={accounts.accounts.find(({ id }) => id === item.accountId)?.name}
        today={today}
        title={loanTitle(item)}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: item.id } })}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title={name} />

      <SectionList
        sections={sections}
        keyExtractor={({ id }) => id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[96px]"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <View
              className={`mx-5 mt-3 mb-1 rounded-2xl border p-5 ${hero.box}`}
              accessible
              accessibilityLabel={`${hero.overline} ${formatAmount(heroAmount)}. ${meta}`}
            >
              <AppText variant="overline">{hero.overline}</AppText>
              <Text
                className={`text-[32px] font-oswald-medium mt-1 ${hero.amount}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.4}
              >
                {formatAmount(heroAmount)}
              </Text>
              <AppText variant="meta">{meta}</AppText>
            </View>
            {!isAllSettled && <AppButton label="Record payment" className="mx-5 mt-3" onPress={recordPayment} />}
          </>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="meta" className="px-5 pt-4 pb-1 text-textMuted" accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={renderItem}
      />

      <AppFab
        icon="plus"
        className="absolute right-5"
        style={{ bottom: insets.bottom + 12 }}
        onPress={() => router.push({ pathname: "/loan/add", params: { borrower: name } })}
        accessibilityLabel={`Add loan for ${name}`}
      />
    </SafeAreaView>
  );
}
