import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import { getPreference, setPreference } from "@/db/preferences";
import { PREF_APP_LOCK_AFTER_MINUTES, PREF_APP_LOCK_ENABLED } from "@/constants/preferences";
import { DEFAULT_LOCK_AFTER_MINUTES, LOCK_AFTER_MINUTES } from "@/constants/appLock";
import { isSystemScreenOpen } from "@/utils/systemScreens";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import { useMount } from "@/utils/useMount";

// "covered" hides the screen while the app is away (or back before the lock is due); "locked" asks to unlock.
export type LockStatus = "unlocked" | "covered" | "locked";

// What turning App lock on got. "no-screen-lock": the phone has no fingerprint, face or PIN for Recur to ask for.
export type EnableResult = "enabled" | "cancelled" | "no-screen-lock";

const SCREEN_CAPTURE_KEY = "app-lock";

export interface AppLockValue {
  isReady: boolean;
  isEnabled: boolean;
  lockAfterMinutes: number;
  status: LockStatus;
  isAuthenticating: boolean;
  unlock: () => Promise<void>;
  // Asks for the phone's lock first, so App lock never turns on where it couldn't be unlocked.
  enable: () => Promise<EnableResult>;
  disable: () => Promise<void>;
  changeLockAfter: (minutes: number) => Promise<void>;
}

const AppLockContext = createContext<AppLockValue | null>(null);

function parseLockAfter(saved: string | null): number {
  const minutes = Number(saved);
  return saved !== null && LOCK_AFTER_MINUTES.some((option) => option === minutes) ? minutes : DEFAULT_LOCK_AFTER_MINUTES;
}

async function hasScreenLock(): Promise<boolean> {
  return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
}

// Owns App lock for the root layout, which waits for `isReady` before hiding the splash screen, then hands the value
// to AppLockProvider.
export function useAppLockState(): AppLockValue {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [lockAfterMinutes, setLockAfterMinutes] = useState(DEFAULT_LOCK_AFTER_MINUTES);
  const [status, setStatusState] = useState<LockStatus>("unlocked");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // Mirrors of the state above for the AppState listener, which reads them between renders.
  const statusRef = useRef<LockStatus>("unlocked");
  const isAuthenticatingRef = useRef(false);
  // Set when the app leaves the foreground on its own, not for a prompt. Null while in the foreground.
  const awayRef = useRef<{ leftAt: number; lockAfterMs: number } | null>(null);

  const setStatus = useCallback((next: LockStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  async function authenticate(promptMessage: string): Promise<boolean> {
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      // The phone's PIN, pattern or password stands in when there's no fingerprint or face, or it fails.
      const result = await LocalAuthentication.authenticateAsync({ promptMessage, requireConfirmation: false });
      return result.success;
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }

  const unlock = useMemoizedFn(async () => {
    if (isAuthenticatingRef.current) {
      return;
    }
    try {
      // The phone's screen lock was removed since: nothing is left to ask for, so App lock turns itself off.
      if (!(await hasScreenLock())) {
        await setPreference(PREF_APP_LOCK_ENABLED, "false");
        setIsEnabled(false);
        setStatus("unlocked");
        Alert.alert(
          "App lock is off",
          "Your phone has no screen lock, so Recur can't lock. Set one, then turn App lock on again in Settings."
        );
        return;
      }
      if (await authenticate("Unlock Recur")) {
        setStatus("unlocked");
      }
    } catch (e) {
      console.error("Unlocking failed", e);
    }
  });

  const enable = useMemoizedFn(async (): Promise<EnableResult> => {
    if (isAuthenticatingRef.current) {
      return "cancelled";
    }
    if (!(await hasScreenLock())) {
      return "no-screen-lock";
    }
    if (!(await authenticate("Turn on App lock"))) {
      return "cancelled";
    }
    await setPreference(PREF_APP_LOCK_ENABLED, "true");
    setIsEnabled(true);
    return "enabled";
  });

  const disable = useMemoizedFn(async () => {
    await setPreference(PREF_APP_LOCK_ENABLED, "false");
    setIsEnabled(false);
  });

  const changeLockAfter = useMemoizedFn(async (minutes: number) => {
    setLockAfterMinutes(minutes);
    await setPreference(PREF_APP_LOCK_AFTER_MINUTES, String(minutes));
  });

  useMount(async () => {
    try {
      const isOn = (await getPreference(PREF_APP_LOCK_ENABLED)) === "true";
      setIsEnabled(isOn);
      setLockAfterMinutes(parseLockAfter(await getPreference(PREF_APP_LOCK_AFTER_MINUTES)));
      if (isOn) {
        setStatus("locked");
        if (AppState.currentState === "active") {
          unlock();
        } else {
          // Launched in the background: the prompt waits for the app to come forward.
          awayRef.current = { leftAt: 0, lockAfterMs: 0 };
        }
      }
    } catch (e) {
      console.error("Reading App lock failed", e);
    } finally {
      setIsReady(true);
    }
  });

  useEffect(() => {
    if (!isEnabled) {
      awayRef.current = null;
      return;
    }
    // A prompt takes the foreground too (Android's PIN screen is its own activity): those changes aren't leaving.
    const subscription = AppState.addEventListener("change", (next) => {
      if (isAuthenticatingRef.current) {
        return;
      }
      if (next === "background") {
        if (awayRef.current === null) {
          // Picking a file or a photo isn't leaving: those get a minute even on Immediately.
          const minutes = isSystemScreenOpen() ? Math.max(lockAfterMinutes, 1) : lockAfterMinutes;
          awayRef.current = { leftAt: Date.now(), lockAfterMs: minutes * 60_000 };
        }
        Keyboard.dismiss();
        if (statusRef.current === "unlocked") {
          setStatus(awayRef.current.lockAfterMs > 0 ? "covered" : "locked");
        }
        return;
      }
      const away = awayRef.current;
      if (next !== "active" || away === null) {
        return;
      }
      awayRef.current = null;
      const awayMs = Date.now() - away.leftAt;
      // A clock set back while away reads as negative time, which locks too.
      if (statusRef.current === "covered" && awayMs >= 0 && awayMs < away.lockAfterMs) {
        setStatus("unlocked");
        return;
      }
      setStatus("locked");
      unlock();
    });
    return () => subscription.remove();
  }, [isEnabled, lockAfterMinutes, setStatus, unlock]);

  // Hides Recur's screen in recent apps. Android can only do that by marking the window secure, which also blocks
  // screenshots; iOS blurs its app switcher snapshot instead.
  useAsyncEffect(async () => {
    if (!isReady) {
      return;
    }
    try {
      if (Platform.OS === "ios") {
        await (isEnabled
          ? ScreenCapture.enableAppSwitcherProtectionAsync()
          : ScreenCapture.disableAppSwitcherProtectionAsync());
      } else {
        await (isEnabled
          ? ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY)
          : ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY));
      }
    } catch (e) {
      console.error("Hiding Recur in recent apps failed", e);
    }
  }, [isReady, isEnabled]);

  return {
    isReady,
    isEnabled,
    lockAfterMinutes,
    status,
    isAuthenticating,
    unlock,
    enable,
    disable,
    changeLockAfter,
  };
}

export function AppLockProvider({ value, children }: { value: AppLockValue; children: React.ReactNode }) {
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockValue {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error("useAppLock must be used within AppLockProvider");
  }
  return context;
}
