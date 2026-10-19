import React from "react";
import { AppTabs } from "@/components/ui/AppTabs";

export const DAY_WINDOWS = [1, 7, 15] as const;
export type DayWindow = (typeof DAY_WINDOWS)[number];

export const windowLabel = (days: number): string => `${days} Day${days === 1 ? "" : "s"}`;

const TABS = DAY_WINDOWS.map((days) => ({ label: windowLabel(days), value: days }));

interface Props {
  value: DayWindow;
  onChange: (value: DayWindow) => void;
}

export function DayWindowSelector({ value, onChange }: Props) {
  return <AppTabs tabs={TABS} value={value} onChange={onChange} />;
}
