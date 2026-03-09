/**
 * useCurrentUser
 *
 * Fetches and caches the current user's database profile.
 * Screens should use this instead of calling usersDB.getCurrentUser() directly.
 */

import { getCurrentUserProfile, usersDB } from "@/lib/database";
import { useCallback, useEffect, useState } from "react";

export interface CurrentUserState {
  user: Awaited<ReturnType<typeof usersDB.getCurrentUser>>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCurrentUser(options?: { skip?: boolean }): CurrentUserState {
  const [user, setUser] = useState<Awaited<ReturnType<typeof usersDB.getCurrentUser>>>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await usersDB.getCurrentUser();
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!options?.skip) fetch();
  }, [fetch, options?.skip]);

  return { user, loading, error, refetch: fetch };
}

// Also export the imperative helper for callbacks that can't use hooks
export { getCurrentUserProfile };

