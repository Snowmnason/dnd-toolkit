/**
 * useBootstrapAuth
 *
 * Checks storage for a recent login token at app boot to determine
 * whether to show the Welcome screen or redirect to world-selection.
 * Encapsulates all StorageManager/STORAGE_KEYS access from app/index.tsx.
 */

import { StorageManager } from "@/lib/storage";
import { STORAGE_KEYS } from "@/maps";
import { useEffect, useState } from "react";

const FRESH_THRESHOLD_MS = 4 * 24 * 60 * 60 * 1000; // 4 days (1-day buffer before Supabase 5-day expiration)

export interface BootstrapAuthState {
  checked: boolean;
  hasAccount: boolean;
}

export function useBootstrapAuth(ready: boolean): BootstrapAuthState {
  const [checked, setChecked] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    if (!ready) return;

    async function check() {
      try {
        const authState = await StorageManager.get<{ hasAccount: boolean }>(
          STORAGE_KEYS.HAS_ACCOUNT,
        );
        if (!authState?.hasAccount) {
          setHasAccount(false);
          setChecked(true);
          return;
        }

        const lastLoggedInStr = await StorageManager.getRaw(STORAGE_KEYS.LAST_LOGGED_IN);
        if (!lastLoggedInStr) {
          setHasAccount(false);
          setChecked(true);
          return;
        }

        const lastLoggedInMs = parseInt(lastLoggedInStr, 10);
        const isWithinFreshThreshold = Date.now() - lastLoggedInMs < FRESH_THRESHOLD_MS;
        setHasAccount(isWithinFreshThreshold);
        setChecked(true);
      } catch {
        setHasAccount(false);
        setChecked(true);
      }
    }

    check();
  }, [ready]);

  return { checked, hasAccount };
}
