/**
 * AppKernel Provider
 *
 * Owns the AppKernel React context and its provider component.
 * Must wrap the entire app at root level — it is the outermost provider.
 *
 * All kernel access goes through lib/kernel (never system/Kernel directly).
 * The consumer hooks (useAppKernel, useAppReady, usePhaseReady) live in
 * hooks/kernel/use-app-kernel.tsx and import AppKernelContext from here.
 *
 * === Navigation Bootstrap ===
 * This provider also bridges Expo Router's `useRouter()` into the system transport layer.
 * This is the ONLY place in the codebase where a provider calls directly into system/.
 * The exception is intentional:
 *   - `useRouter()` requires a React context — it cannot be called from kernel phases
 *   - Navigation failure is a bootstrap failure; it belongs here alongside kernel init
 *   - Collocating it here allows future degrade logic to react to kernel state changes
 *
 * After mount, system/Navigation holds the router instance and all navigation flows
 * through system/lib/hooks without any further React coupling.
 *
 * === FUTURE: Degrade Hook ===
 * If router initialization fails, call reportNavigationFault() here to trigger safe mode.
 * Kernel state is available in this scope, so degradation can be correlated with phase info.
 */

import {
    getKernelState,
    initializeKernel,
    onKernelStateChange,
    type AppKernelState,
} from "@/lib/kernel";
import { logger } from "@/lib/utils/logger";
import { initializeRouter, isTransportReady } from "@/system/Navigation";
import { useRouter } from "expo-router";
import {
    createContext,
    ReactNode,
    useEffect,
    useState,
} from "react";

/**
 * React context for kernel state — exported so consumer hooks can read it.
 */
export const AppKernelContext = createContext<AppKernelState | null>(null);

interface AppKernelProviderProps {
  children: ReactNode;
}

/**
 * Provider component — must wrap the app at root level.
 * Initializes the kernel, seeds the navigation transport layer, and provides
 * kernel state to all consumers.
 */
export function AppKernelProvider({ children }: AppKernelProviderProps) {
  const [state, setState] = useState<AppKernelState>(getKernelState());
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);

  // Obtain the Expo Router instance — the one React hook call allowed here.
  // See module JSDoc for why this lives in a provider rather than a kernel phase.
  const router = useRouter();

  // ── Navigation bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    initializeRouter(router);

    // FUTURE: if (!isTransportReady()) reportNavigationFault('Router failed to initialize');
    if (!isTransportReady()) {
      logger
        .category("bootstrap")
        .error("[AppKernelProvider] Navigation transport failed to initialize");
    }
  }, [router]);

  // ── Kernel bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    logger
      .category("bootstrap")
      .debug("[KERNEL_PROVIDER] Initializing kernel");

    // Initialize kernel once on mount
    initializeKernel().catch((error: unknown) => {
      logger
        .category("bootstrap")
        .error("[AppKernelProvider] CRITICAL: Kernel initialization failed:", error);
      // Store error in state so it's caught by error boundary on next render
      setBootstrapError(error instanceof Error ? error : new Error(String(error)));
    });

    // Subscribe to kernel state changes
    const unsubscribe = onKernelStateChange((newState: AppKernelState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // If bootstrap failed, throw error so error boundary catches it
  if (bootstrapError) {
    throw bootstrapError;
  }

  return (
    <AppKernelContext.Provider value={state}>
      {children}
    </AppKernelContext.Provider>
  );
}
