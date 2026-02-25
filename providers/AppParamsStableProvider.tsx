import { AuthStateManager } from "@/lib/auth/auth-state";
import { getPrivacyStorageBackend, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import React, {
  createContext as createReactContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

// Get the metadata key
const CONNECTED_WORLDS_METADATA =
  STORAGE_KEYS.CONNECTED_WORLDS_METADATA || "dnd:app:connected_worlds_metadata";

/**
 * Rich cache structure for connected worlds
 * Mirrors structure from update-storage-cache.ts
 */
interface ConnectedWorldsCache {
  list: string[];
  roleMap: {
    dm: string[];
    player: string[];
    gm: string[];
    spectator: string[];
    observer: string[];
  };
  counts: {
    dm: number;
    player: number;
    gm: number;
    spectator: number;
    observer: number;
    total: number;
  };
  lastVerifiedAt: number;
}

interface AppParamsStable {
  userId?: string;
  connectedWorldIds: string[];
}

interface AppParamsStableContextType {
  stableParams: AppParamsStable;
  setUserId: (userId: string | undefined) => void;
  setConnectedWorldIds: (worldIds: string[]) => void;
  addConnectedWorld: (worldId: string) => void;
  removeConnectedWorld: (worldId: string) => void;
  hasAccessToWorld: (worldId: string) => boolean;
  clearAllParams: () => void;
}

const AppParamsStableContext = createReactContext<
  AppParamsStableContextType | undefined
>(undefined);
// Separate context for data to enable true selectors - using use-context-selector's createContext
const AppParamsStableDataContext = createContext<AppParamsStable>({
  userId: undefined,
  connectedWorldIds: [],
});

export function AppParamsStableProvider({ children }: { children: ReactNode }) {
  const [stableParams, setStableParams] = useState<AppParamsStable>({
    userId: undefined,
    connectedWorldIds: [],
  });
  const [authStateVersion, setAuthStateVersion] = useState(0);
  const previousUserIdRef = React.useRef<string | undefined>(undefined);
  const isVerifyingRef = React.useRef(false);

  // Load from storage on mount AND when auth state changes
  useEffect(() => {
    async function loadFromStorage() {
      try {
        logger.category('storage').debug(
          "AppParamsStableProvider: Loading userId from storage",
        );
        const userId = await AuthStateManager.getUserId();
        logger.category('storage').debug(`AppParamsStableProvider: Loaded userId=${userId}`);
        if (userId) {
          setStableParams((prev) => ({ ...prev, userId }));
        } else {
          // Clear userId if auth state changes and there's no userId
          setStableParams((prev) => ({ ...prev, userId: undefined }));
        }

        // Load richer cache structure with role breakdown
        const backend = getPrivacyStorageBackend(
          STORAGE_KEYS.CONNECTED_WORLDS,
        );
        const worldIds = await backend.getJSON<string[]>(
          STORAGE_KEYS.CONNECTED_WORLDS,
        );

        // Load rich cache metadata for staleness check and verification
        const metadataBackend = getPrivacyStorageBackend(
          CONNECTED_WORLDS_METADATA,
        );
        const richCache = await metadataBackend.getJSON<ConnectedWorldsCache>(
          CONNECTED_WORLDS_METADATA,
        );

        // SAFETY CHECK: Determine error state based on cache freshness
        // - Empty cache with OLD/MISSING metadata = error state (needs recovery)
        // - Empty cache with FRESH metadata = confirmed empty (no error)
        // - Non-empty cache = normal state (may need staleness check)
        const isEmptyCache = !worldIds || !Array.isArray(worldIds) || worldIds.length === 0;
        const isCacheRecent = isCacheWithinThreshold(richCache, 4 * 60 * 60 * 1000); // 4 hours
        const isErrorState = isEmptyCache && !isCacheRecent;
        const shouldVerify = isErrorState || isVerificationStale(richCache);

        if (isEmptyCache) {
          if (isCacheRecent) {
            // Fresh verification returned 0 worlds - not an error, just confirmed empty
            logger.category('storage').debug(
              `AppParamsStableProvider: Cache is empty but recently verified (${getTimeSinceVerification(richCache)}m ago) - confirmed empty state`,
            );
            setStableParams((prev) => ({
              ...prev,
              connectedWorldIds: [],
            }));
          } else {
            // Old/missing metadata with empty cache - error state, attempt recovery
            logger.category('storage').debug(
              "AppParamsStableProvider: Cache is empty and stale - treating as error state, will attempt verification",
            );

            // IMPORTANT: If userId unavailable (transient auth state), don't block UI
            // Set empty worlds and let screen render - verification will retry when userId arrives
            if (!userId) {
              logger.category('storage').debug(
                "AppParamsStableProvider: Error state but no userId yet (auth still loading) - showing empty worlds, will verify once auth completes",
              );
              setStableParams((prev) => ({
                ...prev,
                connectedWorldIds: [],
              }));
              // Verification will be triggered again when auth state changes and userId becomes available
            } else {
              // userId available - attempt verification in background
              startBackgroundVerification(userId, [], richCache, true);
            }
          }
        } else {
          logger.category('storage').debug(`AppParamsStableProvider: Loaded ${worldIds.length} worlds from persistent cache`);

          // IMPORTANT: Set UI immediately with cached worlds (no blocking)
          // This prevents blank screen on startup/restart
          setStableParams((prev) => ({
            ...prev,
            connectedWorldIds: worldIds,
          }));

          logger.category('storage').debug(
            `AppParamsStableProvider: Rich cache metadata - DM: ${richCache?.counts.dm || 0}, Player: ${richCache?.counts.player || 0}, Last verified: ${richCache?.lastVerifiedAt ? new Date(richCache.lastVerifiedAt).toISOString() : "never"}`,
          );

          // START BACKGROUND VERIFICATION (non-blocking)
          // Only verify if cache is stale; reduce DB calls for offline capabilities
          if (shouldVerify) {
            startBackgroundVerification(userId, worldIds, richCache, false);
          } else {
            logger.category('storage').debug("AppParamsStableProvider: Cache is fresh, skipping verification (offline-friendly)");
          }
        }
      } catch (error) {
        logger.category('storage').error("AppParamsStableProvider: Error loading from storage:", error);
      }
    }

    /**
     * Check if cache was verified within a specific time threshold
     * Used for both error detection and staleness checking
     */
    function isCacheWithinThreshold(
      richCache: ConnectedWorldsCache | null | undefined,
      thresholdMs: number,
    ): boolean {
      if (!richCache?.lastVerifiedAt) {
        return false; // No metadata = not recent
      }

      const cacheAgeMs = Date.now() - richCache.lastVerifiedAt;
      return cacheAgeMs <= thresholdMs;
    }

    /**
     * Get minutes since last verification for logging
     */
    function getTimeSinceVerification(richCache: ConnectedWorldsCache | null | undefined): string {
      if (!richCache?.lastVerifiedAt) {
        return "unknown";
      }

      const cacheAgeMs = Date.now() - richCache.lastVerifiedAt;
      return (cacheAgeMs / 1000 / 60).toFixed(1);
    }

    /**
     * Check if cache is stale (older than 4 hours)
     * Staleness reduces unnecessary DB calls while supporting offline
     * Empty cache (null/undefined lastVerifiedAt) is considered always stale
     */
    function isVerificationStale(richCache: ConnectedWorldsCache | null | undefined): boolean {
      if (!richCache?.lastVerifiedAt) {
        return true; // No metadata = stale
      }

      const fourHoursMs = 4 * 60 * 60 * 1000;
      const cacheAgeMs = Date.now() - richCache.lastVerifiedAt;
      const isStale = cacheAgeMs > fourHoursMs;

      logger.category('storage').debug(
        `AppParamsStableProvider: Cache age check - ${(cacheAgeMs / 1000 / 60).toFixed(1)}m old, stale threshold: 240m, isStale: ${isStale}`,
      );

      return isStale;
    }

    /**
     * Staged verification strategy:
     * 1. If cache is empty → ALWAYS verify (error state)
     * 2. If cache has data → check staleness (4h threshold)
     * 3. If cache is fresh → skip verification (offline friendly)
     * 4. Only update cache if verification returns >= threshold:
     *    - All DM worlds must be verified (DMs = owner, so none should ever be lost)
     *    - Player worlds: expect >= 50% (safer for slow RLS sync or transient network issues)
     * 5. If verification returns 0 while cache > 0: treat as suspicious/transient
     *    - Don't clear cache; mark as degraded; log warning
     *    - This prevents data loss if Supabase is temporarily unreachable
     */
    async function startBackgroundVerification(
      userId: string | undefined,
      cachedWorldIds: string[],
      richCache: ConnectedWorldsCache | null | undefined,
      isErrorState: boolean,
    ) {
      if (isVerifyingRef.current) {
        return;
      }
      try {
        // Set inside try so the finally block always resets the flag,
        // even if an exception is thrown anywhere in the verification body.
        isVerifyingRef.current = true;
        logger.category('storage').info(
          `AppParamsStableProvider: Starting background world verification (errorState: ${isErrorState})`,
        );

        // If empty cache (error state) and no userId, can't verify
        if (isErrorState && !userId) {
          logger.category('storage').warn( 
            "AppParamsStableProvider: Empty cache but no userId - cannot verify, waiting for auth",
          );
          return;
        }

        // Batch verify all worlds efficiently (prevents per-world refresh spam)
        // Instead of N parallel calls to verifyWorldAccessWithDatabase (which could each call
        // refreshAllWorldsCache), do ONE bulk refresh then verify all from cache
        const batchResult = await AuthStateManager.batchVerifyWorldAccess(
          cachedWorldIds,
        );

        // CRITICAL: If verification was deferred (session not ready), do NOT touch the cache.
        // The auth watcher or userId effect will trigger re-verification once session is ready.
        if (batchResult.deferred) {
          logger.category('storage').info(
            "AppParamsStableProvider: Verification deferred (session not ready), keeping cached worlds until session is available",
          );
          return;
        }

        const verifiedWorldIds: string[] = [];
        const results = Array.from(batchResult.results.entries());

        for (const [worldId, hasAccess] of results) {
          if (hasAccess) {
            verifiedWorldIds.push(worldId);
          } else {
            logger.category('storage').info(
              `World ${worldId} access denied or stale`,
            );
          }
        }

        logger.category('storage').info(
          "AppParamsStableProvider: Verification complete",
          {
            cached: cachedWorldIds.length,
            verified: verifiedWorldIds.length,
            isErrorState,
          },
        );

        // ERROR STATE RECOVERY: If cache was empty, populate from verification results
        if (isErrorState && cachedWorldIds.length === 0) {
          if (verifiedWorldIds.length > 0) {
            logger.category('storage').info(
              `AppParamsStableProvider: Recovered ${verifiedWorldIds.length} worlds from error state`,
            );
            // Set state with verified worlds
            setStableParams((prev) => ({
              ...prev,
              connectedWorldIds: verifiedWorldIds,
            }));

            // Update persistent cache
            const verifyBackend = getPrivacyStorageBackend(
              STORAGE_KEYS.CONNECTED_WORLDS,
            );
            await verifyBackend.setJSON(
              STORAGE_KEYS.CONNECTED_WORLDS,
              verifiedWorldIds,
            );
          } else {
            logger.category('storage').info(
              `AppParamsStableProvider: Error state verified - user has 0 worlds`,
            );
            setStableParams((prev) => ({
              ...prev,
              connectedWorldIds: [],
            }));
          }
          return;
        }

        // THRESHOLD LOGIC (for non-error states):
        // If verification returned 0:
        // - It's a legitimate state (user truly has 0 worlds) → clear cache
        if (verifiedWorldIds.length === 0 && cachedWorldIds.length > 0) {
          logger.category('storage').info(
            `AppParamsStableProvider: Verification returned 0 worlds. User has no worlds. Clearing cache.`,
          );
          // Legitimate 0: clear cache and state
          setStableParams((prev) => ({
            ...prev,
            connectedWorldIds: [],
          }));

          const verifyBackend = getPrivacyStorageBackend(
            STORAGE_KEYS.CONNECTED_WORLDS,
          );
          await verifyBackend.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, []);
          return;
        }

        // Check if verification meets expected thresholds
        const dmWorlds = richCache?.roleMap.dm || [];
        const playerWorlds = richCache?.roleMap.player || [];

        // Expect all DM worlds to be verified (DMs = owner/full control)
        const dmVerified = dmWorlds.filter((id) =>
          verifiedWorldIds.includes(id),
        ).length;
        const dmThreshold = dmWorlds.length; // All DM worlds must be present

        // Expect >= 50% of player worlds (safer for transient RLS issues)
        const playerVerified = playerWorlds.filter((id) =>
          verifiedWorldIds.includes(id),
        ).length;
        const playerThreshold = Math.ceil(playerWorlds.length * 0.5);

        const dmMetSafe = dmVerified >= dmThreshold || dmThreshold === 0;
        const playerMetSafe =
          playerVerified >= playerThreshold || playerWorlds.length === 0;

        logger.category("storage").debug(
          `AppParamsStableProvider: Threshold check - DM: ${dmVerified}/${dmThreshold}, Player: ${playerVerified}/${playerThreshold}`,
        );

        // Only update cache if thresholds are met
        if (!dmMetSafe || !playerMetSafe) {
          logger.category("storage").warn(
            `AppParamsStableProvider: Verification did not meet safety thresholds. DM met: ${dmMetSafe}, Player met: ${playerMetSafe}. Cache preserved.`,
          );
          // Don't update cache - keep using what was there
          return;
        }

        // Thresholds met: update state and cache with verified worlds
        setStableParams((prev) => ({
          ...prev,
          connectedWorldIds: verifiedWorldIds,
        }));

        // Update persistent cache
        const verifyBackend = getPrivacyStorageBackend(
          STORAGE_KEYS.CONNECTED_WORLDS,
        );
        await verifyBackend.setJSON(
          STORAGE_KEYS.CONNECTED_WORLDS,
          verifiedWorldIds,
        );

        logger.category("storage").info(
          "AppParamsStableProvider: Cache updated with verified worlds",
        );
      } catch (verificationError) {
        logger.category("storage").warn(
          "AppParamsStableProvider: Verification error, keeping cached worlds",
          verificationError,
        );
        // On verification error, keep cached worlds and surface to user
      } finally {
        isVerifyingRef.current = false;
      }
    }

    loadFromStorage();
  }, [authStateVersion]);

  // Watch for auth state changes
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let watcherToken = 0;

    const setupAuthWatcher = async (attempt = 1, token = ++watcherToken) => {
      const localToken = token;
      try {
        const { getAuthProvider } = await import("@/lib/services");
        const authProvider = await getAuthProvider();
        // Re-check staleness after the async await — a newer watcher may have been
        // started while we were waiting for the auth provider to become available.
        if (localToken !== watcherToken) return;
        const unsubscribe = authProvider.onAuthStateChange(async (session) => {
          if (localToken !== watcherToken) return; // stale watcher
          if (mounted && session !== null) {
            logger.category('auth').debug(
              "AppParamsStableProvider: Auth state changed (signed in), reloading userId...",
            );
            // Small delay to ensure async storage operations complete
            await new Promise((resolve) => setTimeout(resolve, 50));
            if (mounted) {
              setAuthStateVersion((v) => v + 1);
            }
          } else if (mounted && session === null) {
            logger.category('auth').debug(
              "AppParamsStableProvider: Auth state changed (signed out), clearing params and cache metadata...",
            );
            // Clear everything including metadata to force fresh verification on next sign-in
            setStableParams({ userId: undefined, connectedWorldIds: [] });
            const backend = getPrivacyStorageBackend(
              STORAGE_KEYS.CONNECTED_WORLDS,
            );
            void Promise.all([
              backend.removeItem(STORAGE_KEYS.CONNECTED_WORLDS),
              getPrivacyStorageBackend(CONNECTED_WORLDS_METADATA).removeItem(
                CONNECTED_WORLDS_METADATA,
              ),
            ]).catch(() => {
              /* silently ignore cleanup errors on logout */
            });
          }
        });
        subscription = { unsubscribe };
      } catch (error) {
        // Auth provider may not be registered yet during early bootstrap.
        // Retry with exponential backoff (500ms, 1s, 2s) until services phase completes.
        const MAX_RETRIES = 5;
        if (attempt < MAX_RETRIES && mounted) {
          const delayMs = Math.min(500 * Math.pow(2, attempt - 1), 4000);
          logger.category("storage").debug(
            `AppParamsStableProvider: Auth provider not ready, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`,
          );
          retryTimer = setTimeout(() => {
            if (mounted) {
              setupAuthWatcher(attempt + 1, localToken);
            }
          }, delayMs);
        } else {
          logger.category("storage").warn(
            `AppParamsStableProvider: Failed to set up auth watcher after ${attempt} attempts`,
            error,
          );
        }
      }
    };

    setupAuthWatcher();

    return () => {
      mounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      // Invalidate any in-flight watcher
      watcherToken++;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Force re-verification when userId transitions from undefined→defined (auth just completed)
  // This catches the race condition where verification ran before auth was ready
  useEffect(() => {
    const hadNoUserId = previousUserIdRef.current === undefined;
    const nowHasUserId = stableParams.userId !== undefined;

    if (hadNoUserId && nowHasUserId && stableParams.connectedWorldIds.length === 0) {
      logger.category("storage").info(
        "AppParamsStableProvider: UserId just became available with empty worlds - forcing re-verification to catch auth race condition",
      );
      // Bump authStateVersion to trigger loadFromStorage again
      // This time userId is available so verification will run properly
      setAuthStateVersion((v) => v + 1);
    }

    // Update the ref for next comparison
    previousUserIdRef.current = stableParams.userId;
  }, [stableParams.userId, stableParams.connectedWorldIds]);

  const setUserId = useCallback((userId: string | undefined) => {
    setStableParams((prev) => ({ ...prev, userId }));
  }, []);

  const setConnectedWorldIds = useCallback((worldIds: string[]) => {
    setStableParams((prev) => ({ ...prev, connectedWorldIds: worldIds }));
    const backend = getPrivacyStorageBackend(STORAGE_KEYS.CONNECTED_WORLDS);
    void backend.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds).catch(
      (error) => {
        logger.category('storage').error(
          "Failed to persist connected worlds cache",
          error,
        );
      },
    );
  }, []);

  const addConnectedWorld = useCallback((worldId: string) => {
    setStableParams((prev) => {
      if (prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = [...prev.connectedWorldIds, worldId];
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.CONNECTED_WORLDS);
      void backend.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const removeConnectedWorld = useCallback((worldId: string) => {
    setStableParams((prev) => {
      if (!prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = prev.connectedWorldIds.filter((id) => id !== worldId);
      const backend = getPrivacyStorageBackend(STORAGE_KEYS.CONNECTED_WORLDS);
      void backend.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const clearAllParams = useCallback(() => {
    // Always update state to clear in-memory data
    setStableParams({ userId: undefined, connectedWorldIds: [] });

    // Always clear storage, regardless of state (prevents stale data if storage/state mismatch occurs)
    const backend = getPrivacyStorageBackend(STORAGE_KEYS.CONNECTED_WORLDS);
    void Promise.all([
      backend.removeItem(STORAGE_KEYS.CONNECTED_WORLDS),
      // CRITICAL: Also clear metadata to avoid cache stale-ness bug on sign-in
      // If metadata remains, next user's loadFromStorage() sees old lastVerifiedAt
      // and thinks "confirmed empty state" instead of doing fresh verification
      getPrivacyStorageBackend(CONNECTED_WORLDS_METADATA).removeItem(
        CONNECTED_WORLDS_METADATA,
      ),
    ]).catch((error) => {
      logger.category('storage').error("Failed to clear connected worlds cache/metadata", error);
    });
  }, []);

  const hasAccessToWorld = useCallback(
    (worldId: string) => {
      return stableParams.connectedWorldIds.includes(worldId);
    },
    [stableParams.connectedWorldIds],
  );

  const contextValue = React.useMemo(
    () => ({
      stableParams,
      setUserId,
      setConnectedWorldIds,
      addConnectedWorld,
      removeConnectedWorld,
      hasAccessToWorld,
      clearAllParams,
    }),
    [
      stableParams,
      setUserId,
      setConnectedWorldIds,
      addConnectedWorld,
      removeConnectedWorld,
      hasAccessToWorld,
      clearAllParams,
    ],
  );

  return (
    <AppParamsStableDataContext.Provider value={stableParams}>
      <AppParamsStableContext.Provider value={contextValue}>
        {children}
      </AppParamsStableContext.Provider>
    </AppParamsStableDataContext.Provider>
  );
}

export function useAppParamsStable() {
  const context = useContext(AppParamsStableContext);
  if (!context) {
    throw new Error(
      "useAppParamsStable must be used within AppParamsStableProvider",
    );
  }
  return context;
}

// Selector hooks - using useContextSelector for true selectors
// ✅ These now only re-render when their specific selected value changes
export function useUserId() {
  return useContextSelector(
    AppParamsStableDataContext,
    (value) => value.userId,
  );
}

export function useConnectedWorlds() {
  return useContextSelector(
    AppParamsStableDataContext,
    (value) => value.connectedWorldIds,
  );
}
