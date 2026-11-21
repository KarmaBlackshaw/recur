import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getPreference } from "@/db/preferences";
import { PREF_LOW_BALANCE_THRESHOLD } from "@/constants/preferences";

export function parseThreshold(saved: string | null): number | null {
  if (saved == null) {
    return null;
  }
  const n = parseFloat(saved);
  return isNaN(n) ? null : n;
}

// The general low-balance threshold from Settings, or null when unset (the forecast then uses ₱0).
// Re-read on focus, so coming back from Settings or a backup import picks up the new value.
export function useLowBalanceThreshold(): number | null {
  const [threshold, setThreshold] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const saved = await getPreference(PREF_LOW_BALANCE_THRESHOLD);
          if (isActive) {
            setThreshold(parseThreshold(saved));
          }
        } catch (e) {
          console.error("Reading the low-balance threshold failed", e);
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );
  return threshold;
}
