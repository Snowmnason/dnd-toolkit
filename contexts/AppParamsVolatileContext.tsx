import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';

interface AppParamsVolatile {
  worldId?: string;
  userRole?: string;
}

interface AppParamsVolatileContextType {
  volatileParams: AppParamsVolatile;
  setWorldId: (worldId: string | undefined) => void;
  setUserRole: (userRole: string | undefined) => void;
  updateVolatileParams: (newParams: Partial<AppParamsVolatile>) => void;
  clearWorldParams: () => void;
}

const AppParamsVolatileContext = createContext<AppParamsVolatileContextType | undefined>(undefined);

export function AppParamsVolatileProvider({ children }: { children: ReactNode }) {
  const [volatileParams, setVolatileParams] = useState<AppParamsVolatile>({
    worldId: undefined,
    userRole: undefined,
  });

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const savedWorldId = await SecureStorage.getItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
      const savedRole = await SecureStorage.getItem(STORAGE_KEYS.LAST_USER_ROLE);
      if (savedWorldId) setWorldId(savedWorldId);
      if (savedRole) setUserRole(savedRole);
    }
    restoreSession();
  }, []);

  const setWorldId = useCallback((worldId: string | undefined) => {
    setVolatileParams(prev => ({ ...prev, worldId }));
    if (worldId) {
      void SecureStorage.setItem(STORAGE_KEYS.LAST_SELECTED_WORLD, worldId);
    } else {
      void SecureStorage.removeItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
    }
  }, []);

  const setUserRole = useCallback((userRole: string | undefined) => {
    setVolatileParams(prev => ({ ...prev, userRole }));
    if (userRole) {
      void SecureStorage.setItem(STORAGE_KEYS.LAST_USER_ROLE, userRole);
    } else {
      void SecureStorage.removeItem(STORAGE_KEYS.LAST_USER_ROLE);
    }
  }, []);

  const updateVolatileParams = useCallback((newParams: Partial<AppParamsVolatile>) => {
    setVolatileParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const clearWorldParams = useCallback(() => {
    setVolatileParams(prev => ({ ...prev, worldId: undefined, userRole: undefined }));
    void SecureStorage.removeItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
    void SecureStorage.removeItem(STORAGE_KEYS.LAST_USER_ROLE);
  }, []);

  const contextValue = React.useMemo(() => ({
    volatileParams,
    setWorldId,
    setUserRole,
    updateVolatileParams,
    clearWorldParams,
  }), [volatileParams, setWorldId, setUserRole, updateVolatileParams, clearWorldParams]);

  return (
    <AppParamsVolatileContext.Provider value={contextValue}>
      {children}
    </AppParamsVolatileContext.Provider>
  );
}

export function useAppParamsVolatile() {
  const context = useContext(AppParamsVolatileContext);
  if (!context) {
    throw new Error('useAppParamsVolatile must be used within AppParamsVolatileProvider');
  }
  return context;
}

// Selector hooks
export function useWorldId() {
  return useAppParamsVolatile().volatileParams.worldId;
}

export function useUserRole() {
  return useAppParamsVolatile().volatileParams.userRole;
}