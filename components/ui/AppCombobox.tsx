import React, { forwardRef, type ComponentPropsWithoutRef } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { useBoolean } from "@/utils/useBoolean";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";

interface AppComboboxProps extends ComponentPropsWithoutRef<typeof AppTextInput> {
  items: string[];
  onPick: (item: string) => void;
}

const MAX_MATCHES = 5;

export const AppCombobox = forwardRef<TextInput, AppComboboxProps>(
  function AppCombobox({ items, onPick, value = "", onPressIn, onChangeText, onBlur, ...props }, ref) {
    const [isOpen, { setTrue: open, setFalse: close }] = useBoolean(false);
    const query = value.trim().toLowerCase();
    const matches = items
      .filter((item) => {
        const name = item.toLowerCase();
        return name.includes(query) && name !== query;
      })
      .slice(0, MAX_MATCHES);

    return (
      <View className="z-10">
        <AppTextInput
          ref={ref}
          {...props}
          value={value}
          onPressIn={(e) => {
            open();
            onPressIn?.(e);
          }}
          onChangeText={(text) => {
            open();
            onChangeText?.(text);
          }}
          onBlur={(e) => {
            close();
            onBlur?.(e);
          }}
        />
        {isOpen && matches.length > 0 && (
          <View
            className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-surface overflow-hidden"
            accessibilityRole="list"
          >
            {matches.map((item, index) => (
              <TouchableOpacity
                key={item}
                className={`min-h-[44px] justify-center px-4 ${index > 0 ? "border-t border-border" : "border-t-0"}`}
                onPress={() => {
                  close();
                  onPick(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${item}`}
              >
                <AppText variant="body-medium" className="text-sm text-textSecondary">
                  {item}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }
);
