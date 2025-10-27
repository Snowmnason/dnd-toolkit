import { logger } from '@/lib';
import { AuthStateManager } from '@/lib/auth-state';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface AppParams {
  userId?: string;
  worldId?: string;
  userRole?: string;
}

interface AppParamsContextType {
  params: AppParams;
  setUserId: (userId: string | undefined) => void;
  setWorldId: (worldId: string | undefined) => void;
  setUserRole: (userRole: string | undefined) => void;
  updateParams: (newParams: Partial<AppParams>) => void;
  clearWorldParams: () => void;
  clearAllParams: () => void;
}

const AppParamsContext = createContext<AppParamsContextType | undefined>(undefined);

export function AppParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<AppParams>({
    userId: undefined,
    worldId: undefined,
    userRole: undefined,
  });

  // Load userId from storage on mount
  useEffect(() => {
    async function loadUserId() {
      try {
        const userId = await AuthStateManager.getUserId();
        if (userId) {
          setParams(prev => ({ ...prev, userId }));
          logger.debug('AppParamsContext', 'Loaded userId from storage:', userId);
        }
      } catch (error) {
        logger.error('AppParamsContext', 'Error loading userId from storage:', error);
      }
    }
    loadUserId();
  }, []);

  const setUserId = useCallback((userId: string | undefined) => {
    setParams(prev => ({ ...prev, userId }));
  }, []);

  const setWorldId = useCallback((worldId: string | undefined) => {
    setParams(prev => ({ ...prev, worldId }));
  }, []);

  const setUserRole = useCallback((userRole: string | undefined) => {
    setParams(prev => ({ ...prev, userRole }));
  }, []);

  const updateParams = useCallback((newParams: Partial<AppParams>) => {
    setParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const clearWorldParams = useCallback(() => {
    setParams(prev => ({ ...prev, worldId: undefined, userRole: undefined }));
  }, []);

  const clearAllParams = useCallback(() => {
    setParams({ userId: undefined, worldId: undefined, userRole: undefined });
  }, []);

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
