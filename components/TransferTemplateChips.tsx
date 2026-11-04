import React from "react";
import { TouchableOpacity, View } from "react-native";
import { AppChips } from "@/components/ui/AppChips";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppText } from "@/components/ui/AppText";
import type { TransferTemplate } from "@/types";

interface Props {
  templates: TransferTemplate[];
  appliedId: string;
  onApply: (template: TransferTemplate) => void;
  onManage: () => void;
}

export function TransferTemplateChips({ templates, appliedId, onApply, onManage }: Props) {
  if (templates.length === 0) {
    return null;
  }
  const chips = templates.map(({ id, name }) => ({ value: id, label: name }));

  function handleChange(id: string) {
    const template = templates.find((t) => t.id === id);
    if (template) {
      onApply(template);
    }
  }

  return (
    <>
      <View className="flex-row items-center justify-between">
        <AppLabel>Templates</AppLabel>
        <TouchableOpacity
          onPress={onManage}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Manage transfer templates"
        >
          <AppText variant="body-bold" className="text-xs text-textSecondary">Manage</AppText>
        </TouchableOpacity>
      </View>
      <AppChips
        chips={chips}
        value={appliedId}
        onChange={handleChange}
        accessibilityLabel="Transfer templates"
        className="-mx-5 mb-4"
      />
    </>
  );
}
