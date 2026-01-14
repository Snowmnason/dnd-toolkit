import { logger } from '@/lib/utils/logger';
import { AuthStateManager } from '@/lib/auth-state';
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

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

const AppParamsStableContext = createContext<AppParamsStableContextType | undefined>(undefined);

export function AppParamsStableProvider({ children }: { children: ReactNode }) {
  const [stableParams, setStableParams] = useState<AppParamsStable>({
    userId: undefined,
    connectedWorldIds: [],
  });

  // Load from storage on mount
  useEffect(() => {
    async function loadFromStorage() {
      try {
        const userId = await AuthStateManager.getUserId();
        if (userId) {
          setStableParams(prev => ({ ...prev, userId }));
        }

        const worldIds = await SecureStorage.getJSON<string[]>(STORAGE_KEYS.CONNECTED_WORLDS);
        if (worldIds && Array.isArray(worldIds)) {
          setStableParams(prev => ({ ...prev, connectedWorldIds: worldIds }));
        }
      } catch (error) {
        logger.error('AppParamsStableContext', 'Error loading from storage:', error);
      }
    }
    loadFromStorage();
  }, []);

  const setUserId = useCallback((userId: string | undefined) => {
    setStableParams(prev => ({ ...prev, userId }));
  }, []);

  const setConnectedWorldIds = useCallback((worldIds: string[]) => {
    setStableParams(prev => ({ ...prev, connectedWorldIds: worldIds }));
    void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds).catch(error => {
      logger.error('AppParamsStableContext', 'Failed to persist connected worlds cache', error);
    });
  }, []);

  const addConnectedWorld = useCallback((worldId: string) => {
    setStableParams(prev => {
      if (prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = [...prev.connectedWorldIds, worldId];
      void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const removeConnectedWorld = useCallback((worldId: string) => {
    setStableParams(prev => {
      if (!prev.connectedWorldIds.includes(worldId)) return prev;
      const updated = prev.connectedWorldIds.filter(id => id !== worldId);
      void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updated);
      return { ...prev, connectedWorldIds: updated };
    });
  }, []);

  const clearAllParams = useCallback(() => {
    setStableParams({ userId: undefined, connectedWorldIds: [] });
    void SecureStorage.removeItem(STORAGE_KEYS.CONNECTED_WORLDS).catch(error => {
      logger.error('AppParamsStableContext', 'Failed to clear connected worlds cache', error);
    });
  }, []);

  const hasAccessToWorld = useCallback((worldId: string) => {
    return stableParams.connectedWorldIds.includes(worldId);
  }, [stableParams.connectedWorldIds]);

  const contextValue = React.useMemo(() => ({
    stableParams,
    setUserId,
    setConnectedWorldIds,
    addConnectedWorld,
    removeConnectedWorld,
    hasAccessToWorld,
    clearAllParams,
  }), [stableParams, setUserId, setConnectedWorldIds, addConnectedWorld, removeConnectedWorld, hasAccessToWorld, clearAllParams]);

  return (
    <AppParamsStableContext.Provider value={contextValue}>
      {children}
    </AppParamsStableContext.Provider>
  );
}

export function useAppParamsStable() {
  const context = useContext(AppParamsStableContext);
  if (!context) {
    throw new Error('useAppParamsStable must be used within AppParamsStableProvider');
  }
  return context;
}

// Selector hooks
export function useUserId() {
  return useAppParamsStable().stableParams.userId;
}

export function useConnectedWorlds() {
  return useAppParamsStable().stableParams.connectedWorldIds;
}