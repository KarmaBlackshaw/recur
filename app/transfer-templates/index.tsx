import React from "react";
import { Alert, FlatList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useAccounts } from "@/context/AccountContext";
import { useTransferTemplates } from "@/context/TransferTemplateContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppListRow } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { LoadingState } from "@/components/ui/LoadingState";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { colors } from "@/constants/theme";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { formatAmount } from "@/utils/formatAmount";
import type { TransferTemplate } from "@/types";

export default function TransferTemplatesScreen() {
  const accounts = useAccounts();
  const { templates, isLoading, deleteTemplate } = useTransferTemplates();

  function accountName(accountId: string) {
    return accounts.accounts.find((a) => a.id === accountId)?.name ?? "Deleted account";
  }

  function confirmDelete(template: TransferTemplate) {
    Alert.alert("Delete template?", "Transfers you made with it stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTemplate(template.id);
          } catch (e) {
            console.error("Delete template failed", e);
            alertFailure("Delete failed", e);
          }
        },
      },
    ]);
  }

  function addTemplate() {
    router.push("/transfer-templates/edit");
  }

  function renderTemplate(template: TransferTemplate) {
    const meta = `${accountName(template.fromId)} → ${accountName(template.toId)}`;
    const caption =
      template.income > 0
        ? `+${formatAmount(template.income)} earned`
        : template.fee > 0
          ? `${formatAmount(template.fee)} fee`
          : undefined;
    const amount = formatAmount(template.amount);
    const spoken = [template.name, meta.replace(" → ", " to "), amount, caption?.replace(/^\+/, "")].filter(Boolean).join(", ");
    return (
      <SwipeableRow rightAction={{ label: "Delete", icon: "trash-2", tone: "negative", onPress: () => confirmDelete(template) }}>
        <AppListRow
          icon="repeat"
          title={template.name}
          meta={meta}
          amount={amount}
          amountTone="muted"
          caption={caption}
          captionTone={template.income > 0 ? "positive" : "neutral"}
          accessory="chevron-right"
          onPress={() => router.push({ pathname: "/transfer-templates/edit", params: { id: template.id } })}
          accessibilityLabel={spoken}
          accessibilityHint="Opens the template to edit"
        />
      </SwipeableRow>
    );
  }

  const isLoaded = !isLoading && !accounts.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title="Transfer templates"
        right={
          <TouchableOpacity
            onPress={addTemplate}
            className="min-w-[44px] h-[44px] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="New template"
          >
            <Feather name="plus" size={24} color={colors.secondary} />
          </TouchableOpacity>
        }
      />
      {!isLoaded ? (
        <LoadingState />
      ) : templates.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Feather name="bookmark" size={40} color={colors.textMuted} />
          <AppText variant="title" className="text-center">No templates yet</AppText>
          <AppText variant="meta" className="text-center">
            Save a transfer you make often, then fill it in with one tap.
          </AppText>
          <AppButton label="New template" variant="tonal" onPress={addTemplate} />
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => renderTemplate(item)}
          contentContainerClassName="pb-[140px]"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
