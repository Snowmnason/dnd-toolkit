/**
 * AppKernel React Context and Hook
 *
 * Provides centralized access to kernel state throughout the app.
 * Must wrap the app at the root level for all consumers to work.
 *
 * All kernel access goes through lib/kernel/kernel-manager (never system/Kernel directly).
 */

import {
  getKernelState,
  initializeKernel,
  onKernelStateChange,
  type AppKernelState,
} from "@/lib/kernel/kernel-manager";
import { logger } from "@/lib/utils/logger";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

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
  const [state, setState] = useState<AppKernelState>(getKernelState());

  useEffect(() => {
    logger
      .category("bootstrap")
      .debug("[KERNEL_PROVIDER] Initializing kernel");

    // Initialize kernel once on mount
    initializeKernel().catch((error: unknown) => {
      logger
        .category("bootstrap")
        .error("[AppKernelProvider] Kernel initialization failed:", error);
    });

    // Subscribe to kernel state changes
    const unsubscribe = onKernelStateChange((newState: AppKernelState) => {
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
    throw new Error("useAppKernel must be called within an AppKernelProvider");
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
 * Type-safe: TypeScript enforces phase must be a valid key of AppKernelState['phases']
 */
export function usePhaseReady(phase: keyof AppKernelState["phases"]): boolean {
  const kernel = useAppKernel();
  // eslint-disable-next-line security/detect-object-injection
  return kernel.phases[phase];
}
