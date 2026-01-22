/**
 * AppKernel React Context and Hook
 *
 * Provides centralized access to kernel state throughout the app.
 * Must wrap the app at the root level for all consumers to work.
 */

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { logger } from "../utils/logger";
import { AppKernel, AppKernelState } from "./app-kernel";

// Module-level diagnostic
console.log("[KERNEL_PROVIDER] Module loaded, typeof window:", typeof window);

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
  console.log("[KERNEL_PROVIDER] Render: Provider component mounted");
  const [state, setState] = useState<AppKernelState>(AppKernel.getState());

  useEffect(() => {
    console.log(
      "[KERNEL_PROVIDER] useEffect: Hook fired, calling AppKernel.initialize()",
    );

    // Initialize kernel once on mount
    AppKernel.initialize().catch((error: unknown) => {
      console.error(
        "[KERNEL_PROVIDER] useEffect: Kernel initialization failed:",
        error,
      );
      logger
        .category("bootstrap")
        .error("[AppKernelProvider] Kernel initialization failed:", error);
    });

    console.log(
      "[KERNEL_PROVIDER] useEffect: AppKernel.initialize() called (async), subscribing to state",
    );

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
  return kernel.phases[phase as keyof AppKernelState["phases"]];
}
