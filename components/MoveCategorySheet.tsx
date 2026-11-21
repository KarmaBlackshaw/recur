import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { AppConfirmSheet, type AppConfirmSheetRef } from "@/components/ui/AppConfirmSheet";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppText } from "@/components/ui/AppText";
import { categoryUsesLabel } from "@/utils/categoryUsesLabel";
import type { CategoryKind } from "@/types";

export interface MoveCategoryTarget {
  name: string;
  kind: CategoryKind;
  uses: number;
  // The categories its rows can move to.
  options: string[];
}

export interface MoveCategorySheetRef {
  // Resolves with the category picked to take the rows, or null when closed without confirming.
  ask: (target: MoveCategoryTarget) => Promise<string | null>;
}

function usesText({ kind, uses }: MoveCategoryTarget) {
  const rows = categoryUsesLabel(kind, uses);
  return uses === 1
    ? `${rows} uses this category. It moves to the one you pick.`
    : `${rows} use this category. They move to the one you pick.`;
}

// Deleting a category in use: its rows have to go to another category first.
export const MoveCategorySheet = forwardRef<MoveCategorySheetRef>(function MoveCategorySheet(_props, ref) {
  const confirmRef = useRef<AppConfirmSheetRef>(null);
  const [target, setTarget] = useState<MoveCategoryTarget | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const moveToRef = useRef("");

  function pick(name: string) {
    moveToRef.current = name;
    setMoveTo(name);
  }

  useImperativeHandle(ref, () => ({
    ask: async (next) => {
      setTarget(next);
      pick("");
      const isConfirmed = (await confirmRef.current?.ask()) ?? false;
      return isConfirmed && moveToRef.current !== "" ? moveToRef.current : null;
    },
  }));

  return (
    <AppConfirmSheet
      ref={confirmRef}
      title={target ? `Delete ${target.name}?` : "Delete category?"}
      confirmLabel="Move and delete"
      isConfirmDisabled={moveTo === ""}
    >
      {target && (
        <>
          <AppText variant="meta" className="-mt-2 mb-4">{usesText(target)}</AppText>
          <AppRadioGroup
            label="Move to"
            options={target.options.map((name) => ({ label: name, value: name }))}
            value={moveTo}
            onChange={pick}
          />
        </>
      )}
    </AppConfirmSheet>
  );
});
