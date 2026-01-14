import { AuthStateManager } from '@/lib/auth/auth-state';
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface AppParams {
  userId?: string;
  worldId?: string;
  userRole?: string;
  connectedWorldIds: string[]; // Cache of world IDs user has access to
}

interface AppParamsContextType {
  params: AppParams;
  setUserId: (userId: string | undefined) => void;
  setWorldId: (worldId: string | undefined) => void;
  setUserRole: (userRole: string | undefined) => void;
  updateParams: (newParams: Partial<AppParams>) => void;
  clearWorldParams: () => void;
  clearAllParams: () => void;
  setConnectedWorldIds: (worldIds: string[]) => void;
  addConnectedWorld: (worldId: string) => void;
  removeConnectedWorld: (worldId: string) => void;
  hasAccessToWorld: (worldId: string) => boolean;
}

const AppParamsContext = createContext<AppParamsContextType | undefined>(undefined);

export function AppParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<AppParams>({
    userId: undefined,
    worldId: undefined,
    userRole: undefined,
    connectedWorldIds: [],
  });

  // Load userId and connected worlds from storage on mount
  useEffect(() => {
    async function loadFromStorage() {
      try {
        // Load userId
        const userId = await AuthStateManager.getUserId();
        if (userId) {
          setParams(prev => ({ ...prev, userId }));
          logger.debug('other', 'Loaded userId from storage:', userId);
        }

        // Load connected worlds cache from SecureStorage
        const worldIds = await SecureStorage.getJSON<string[]>(STORAGE_KEYS.CONNECTED_WORLDS);
        if (worldIds && Array.isArray(worldIds)) {
          setParams(prev => ({ ...prev, connectedWorldIds: worldIds }));
          logger.debug('other', 'Loaded connected worlds from SecureStorage:', worldIds);
        }
      } catch (error) {
        logger.error('other', 'Error loading from storage:', error);
      }
    }
    loadFromStorage();
  }, []);

  const setUserId = useCallback((userId: string | undefined) => {
    setParams(prev => {
      if (prev.userId !== userId) {
        logger.category('ui').debug('AppParams: userId changed', { from: prev.userId, to: userId });
      }
      return { ...prev, userId };
    });
  }, []);

  const setWorldId = useCallback((worldId: string | undefined) => {
    setParams(prev => {
      if (prev.worldId !== worldId) {
        logger.category('ui').debug('AppParams: worldId changed', { from: prev.worldId, to: worldId });
      }
      return { ...prev, worldId };
    });
  }, []);

  const setUserRole = useCallback((userRole: string | undefined) => {
    setParams(prev => {
      if (prev.userRole !== userRole) {
        logger.category('ui').debug('AppParams: userRole changed', { from: prev.userRole, to: userRole });
      }
      return { ...prev, userRole };
    });
  }, []);

  const updateParams = useCallback((newParams: Partial<AppParams>) => {
    setParams(prev => {
      const changed: string[] = [];
      Object.keys(newParams).forEach(key => {
        if (prev[key as keyof AppParams] !== newParams[key as keyof AppParams]) {
          changed.push(key);
        }
      });
      if (changed.length > 0) {
        logger.category('ui').debug('AppParams: batch update', { changedKeys: changed, newValues: newParams });
      }
      return { ...prev, ...newParams };
    });
  }, []);

  const clearWorldParams = useCallback(() => {
    setParams(prev => ({ ...prev, worldId: undefined, userRole: undefined }));
  }, []);

  const clearAllParams = useCallback(() => {
    setParams({ userId: undefined, worldId: undefined, userRole: undefined, connectedWorldIds: [] });
    void SecureStorage.removeItem(STORAGE_KEYS.CONNECTED_WORLDS).catch(error => {
      logger.error('other', 'Failed to clear connected worlds cache', error);
    });
  }, []);

  const setConnectedWorldIds = useCallback((worldIds: string[]) => {
    setParams(prev => ({ ...prev, connectedWorldIds: worldIds }));
    void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds).catch(error => {
      logger.error('other', 'Failed to persist connected worlds cache', error);
    });
    logger.debug('other', 'Updated connected worlds cache:', worldIds);
  }, []);

  const addConnectedWorld = useCallback((worldId: string) => {
    let added = false;
    let updatedWorldIds: string[] | undefined;

    setParams(prev => {
      if (prev.connectedWorldIds.includes(worldId)) {
        updatedWorldIds = prev.connectedWorldIds;
        return prev;
      }

      added = true;
      updatedWorldIds = [...prev.connectedWorldIds, worldId];
      return { ...prev, connectedWorldIds: updatedWorldIds };
    });

    if (!added || !updatedWorldIds) return;

    void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updatedWorldIds).catch(error => {
      logger.error('other', 'Failed to persist added world cache', error);
    });
    logger.debug('other', 'Added world to cache:', worldId);
  }, []);

  const removeConnectedWorld = useCallback((worldId: string) => {
    let removed = false;
    let updatedWorldIds: string[] | undefined;

    setParams(prev => {
      if (!prev.connectedWorldIds.includes(worldId)) {
        updatedWorldIds = prev.connectedWorldIds;
        return prev;
      }

      removed = true;
      updatedWorldIds = prev.connectedWorldIds.filter(id => id !== worldId);
      return { ...prev, connectedWorldIds: updatedWorldIds };
    });

    if (!removed || !updatedWorldIds) return;

    void SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, updatedWorldIds).catch(error => {
      logger.error('other', 'Failed to persist removed world cache', error);
    });
    logger.debug('other', 'Removed world from cache:', worldId);
  }, []);

  const hasAccessToWorld = useCallback((worldId: string) => {
    return params.connectedWorldIds.includes(worldId);
  }, [params.connectedWorldIds]);

  return (
    <AppParamsContext.Provider
      value={{
        params,
        setUserId,
        setWorldId,
        setUserRole,
        updateParams,
        clearWorldParams,
        clearAllParams,
        setConnectedWorldIds,
        addConnectedWorld,
        removeConnectedWorld,
        hasAccessToWorld,
      }}
    >
      {children}
    </AppParamsContext.Provider>
  );
}

export function useAppParams() {
  const context = useContext(AppParamsContext);
  if (context === undefined) {
    throw new Error('useAppParams must be used within an AppParamsProvider');
  }
  return context;
}
