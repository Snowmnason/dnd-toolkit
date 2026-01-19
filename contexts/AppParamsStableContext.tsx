import { AuthStateManager } from "@/lib/auth/auth-state";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
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

  // Load from storage on mount AND when auth state changes
  useEffect(() => {
    async function loadFromStorage() {
      try {
        logger.debug(
          "context",
          "AppParamsStableProvider: Loading userId from storage"
        );
        const userId = await AuthStateManager.getUserId();
        logger.debug(
          "context",
          `AppParamsStableProvider: Loaded userId=${userId}`
        );
        if (userId) {
          setStableParams((prev) => ({ ...prev, userId }));
        } else {
          // Clear userId if auth state changes and there's no userId
          setStableParams((prev) => ({ ...prev, userId: undefined }));
        }

        const worldIds = await SecureStorage.getJSON<string[]>(
          STORAGE_KEYS.CONNECTED_WORLDS
        );
        if (worldIds && Array.isArray(worldIds)) {
          setStableParams((prev) => ({ ...prev, connectedWorldIds: worldIds }));

          // Background verification against Supabase
          // Verify each world access with Supabase (lazy verification)
          setTimeout(async () => {
            try {
              logger.debug(
                "context",
                "AppParamsStableProvider: Starting background world access verification"
              );
              const verifiedWorldIds: string[] = [];

              for (const worldId of worldIds) {
                const verification =
                  await AuthStateManager.verifyWorldAccessWithDatabase(
                    worldId,
                    (reason: string) => {
                      // Access revoked for this world
                      logger.warn(
                        "context",
                        `World ${worldId} access revoked:`,
                        reason
                      );
                      // Could show a toast here if needed
                    }
                  );

                if (verification.hasAccess) {
                  verifiedWorldIds.push(worldId);
                }
              }

              // Update context with verified list if changed
              if (
                JSON.stringify(verifiedWorldIds) !== JSON.stringify(worldIds)
              ) {
                logger.info(
                  "context",
                  "AppParamsStableProvider: World access list updated from Supabase",
                  {
                    cached: worldIds.length,
                    verified: verifiedWorldIds.length,
                  }
                );

                // Persist verified list to storage
                await SecureStorage.setJSON(
                  STORAGE_KEYS.CONNECTED_WORLDS,
                  verifiedWorldIds
                );

                setStableParams((prev) => ({
                  ...prev,
                  connectedWorldIds: verifiedWorldIds,
                }));
              }
            } catch (error) {
              logger.error(
                "context",
                "AppParamsStableProvider: Background verification failed:",
                error
              );
              // Keep cached values on error
            }
          }, 500); // Delay to not block initial render
        }
      } catch (error) {
        logger.error(
          "context",
          "AppParamsStableProvider: Error loading from storage:",
          error
        );
      }
    }
    loadFromStorage();
  }, [authStateVersion]);

  // Watch for auth state changes
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupAuthWatcher = async () => {
      try {
        const { isSupabaseConfigured } =
          await import("@/lib/database/supabase");
        if (!isSupabaseConfigured()) {
          logger.debug(
            "context",
            "AppParamsStableProvider: Supabase not configured, skipping auth watcher"
          );
          return;
        }

        const { supabase } = await import("@/lib/database/supabase");
        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange(async (event: string) => {
          if (
            mounted &&
            (event === "SIGNED_IN" || event === "INITIAL_SESSION")
          ) {
            logger.debug(
              "context",
              `AppParamsStableProvider: Auth state changed (${event}), reloading userId...`
            );
            // Small delay to ensure async storage operations complete
            await new Promise((resolve) => setTimeout(resolve, 50));
            if (mounted) {
              setAuthStateVersion((v) => v + 1);
            }
          }
        });
        subscription = sub ?? null;
      } catch (error) {
        logger.debug(
          "context",
          "AppParamsStableProvider: Error setting up auth watcher:",
          error
        );
      }
    };

    setupAuthWatcher();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const setUserId = useCallback((userId: string | undefined) => {
    setStableParams((prev) => ({ ...prev, userId }));
  }, []);

  const setConnectedWorldIds = useCallback((worldIds: string[]) => {
    setStableParams((prev) => ({ ...prev, connectedWorldIds: worldIds }));
    void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds).catch(
      (error) => {
        logger.error(
          "other",
          "Failed to persist connected worlds cache",
          error
        );
      }
    );
  }, []);

  const addConnectedWorld = useCallback((worldId: string) => {
    setStableParams((prev) => {
      if (prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = [...prev.connectedWorldIds, worldId];
      void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const removeConnectedWorld = useCallback((worldId: string) => {
    setStableParams((prev) => {
      if (!prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = prev.connectedWorldIds.filter((id) => id !== worldId);
      void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const clearAllParams = useCallback(() => {
    // Always update state to clear in-memory data
    setStableParams({ userId: undefined, connectedWorldIds: [] });

    // Always clear storage, regardless of state (prevents stale data if storage/state mismatch occurs)
    void SecureStorage.removeItem(STORAGE_KEYS.CONNECTED_WORLDS).catch(
      (error) => {
        logger.error("other", "Failed to clear connected worlds cache", error);
      }
    );
  }, []);

  const hasAccessToWorld = useCallback(
    (worldId: string) => {
      return stableParams.connectedWorldIds.includes(worldId);
    },
    [stableParams.connectedWorldIds]
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
    ]
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
      "useAppParamsStable must be used within AppParamsStableProvider"
    );
  }
  return context;
}

// Selector hooks - using useContextSelector for true selectors
// ✅ These now only re-render when their specific selected value changes
export function useUserId() {
  return useContextSelector(
    AppParamsStableDataContext,
    (value) => value.userId
  );
}

export function useConnectedWorlds() {
  return useContextSelector(
    AppParamsStableDataContext,
    (value) => value.connectedWorldIds
  );
}
