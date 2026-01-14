import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';

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
// Separate context for data to enable true selectors
const AppParamsVolatileDataContext = createContext<AppParamsVolatile>({
  worldId: undefined,
  userRole: undefined,
});

export function AppParamsVolatileProvider({ children }: { children: ReactNode }) {
  const [volatileParams, setVolatileParams] = useState<AppParamsVolatile>({
    worldId: undefined,
    userRole: undefined,
  });

  // ✅ Define functions BEFORE useEffect
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
    setVolatileParams(prev => {
      const updated = { ...prev, ...newParams };

      // ✅ Persist all changes to storage
      if (updated.worldId !== undefined) {
        if (updated.worldId) {
          void SecureStorage.setItem(STORAGE_KEYS.LAST_SELECTED_WORLD, updated.worldId);
        } else {
          void SecureStorage.removeItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
        }
      }

      if (updated.userRole !== undefined) {
        if (updated.userRole) {
          void SecureStorage.setItem(STORAGE_KEYS.LAST_USER_ROLE, updated.userRole);
        } else {
          void SecureStorage.removeItem(STORAGE_KEYS.LAST_USER_ROLE);
        }
      }

      return updated;
    });
  }, []);

  const clearWorldParams = useCallback(() => {
    setVolatileParams(prev => ({ ...prev, worldId: undefined, userRole: undefined }));
    void SecureStorage.removeItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
    void SecureStorage.removeItem(STORAGE_KEYS.LAST_USER_ROLE);
  }, []);

  // ✅ Now useEffect can safely call the functions
  useEffect(() => {
    async function restoreSession() {
      const savedWorldId = await SecureStorage.getItem(STORAGE_KEYS.LAST_SELECTED_WORLD);
      const savedRole = await SecureStorage.getItem(STORAGE_KEYS.LAST_USER_ROLE);
      if (savedWorldId) setWorldId(savedWorldId);
      if (savedRole) setUserRole(savedRole);
    }
    restoreSession();
  }, [setWorldId, setUserRole]);

  // ✅ Only stable functions in memoization
  const contextValue = React.useMemo(() => ({
    volatileParams,
    setWorldId,
    setUserRole,
    updateVolatileParams,
    clearWorldParams,
  }), [setWorldId, setUserRole, updateVolatileParams, clearWorldParams]);

  return (
    <AppParamsVolatileDataContext.Provider value={volatileParams}>
      <AppParamsVolatileContext.Provider value={contextValue}>
        {children}
      </AppParamsVolatileContext.Provider>
    </AppParamsVolatileDataContext.Provider>
  );
}

export function useAppParamsVolatile() {
  const context = useContext(AppParamsVolatileContext);
  if (!context) {
    throw new Error('useAppParamsVolatile must be used within AppParamsVolatileProvider');
  }
  return context;
}

// Selector hooks - using useContextSelector for true selectors
// ✅ These now only re-render when their specific selected value changes
export function useWorldId() {
  return useContextSelector(AppParamsVolatileDataContext, (value) => value.worldId);
}

export function useUserRole() {
  return useContextSelector(AppParamsVolatileDataContext, (value) => value.userRole);
}