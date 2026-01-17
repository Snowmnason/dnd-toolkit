/**
 * AppKernel React Context and Hook
 *
 * Provides centralized access to kernel state throughout the app.
 * Must wrap the app at the root level for all consumers to work.
 */

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppKernel, AppKernelState } from './app-kernel';

/**
 * React context for kernel state
 */
const AppKernelContext = createContext<AppKernelState | null>(null);

interface AppKernelProviderProps {
  children: ReactNode;
}

/**
 * Provider component - must wrap the app at root level
 * Initializes the kernel and provides state to all consumers
 */
export function AppKernelProvider({ children }: AppKernelProviderProps) {
  const [state, setState] = useState<AppKernelState>(AppKernel.getState());

  useEffect(() => {
    // Initialize kernel once on mount
    AppKernel.initialize().catch((error: unknown) => {
      // Error is already logged in kernel, but we can handle it here if needed
      console.error('[AppKernelProvider] Kernel initialization failed:', error);
    });

    // Subscribe to kernel state changes
    const unsubscribe = AppKernel.subscribe((newState: AppKernelState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AppKernelContext.Provider value={state}>
      {children}
    </AppKernelContext.Provider>
  );
}

/**
 * Hook to access kernel state
 * Must be called within AppKernelProvider
 */
export function useAppKernel(): AppKernelState {
  const state = useContext(AppKernelContext);
  if (state === null) {
    throw new Error('useAppKernel must be called within an AppKernelProvider');
  }
  return state;
}

/**
 * Hook to check if app is ready (shorthand)
 */
export function useAppReady(): boolean {
  const kernel = useAppKernel();
  return kernel.phases.appReady;
}

/**
 * Hook to check if a specific phase is ready
 */
export function usePhaseReady(phase: keyof AppKernelState['phases']): boolean {
  const kernel = useAppKernel();
  if (typeof phase !== 'string' || !(phase in kernel.phases)) {
    throw new Error(`Invalid phase: ${String(phase)}`);
  }
  return kernel.phases[phase as keyof AppKernelState['phases']];
}
