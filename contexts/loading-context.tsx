import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

/**
 * 🔄 LoadingProvider
 *
 * Generalized loading context for blocking UI during critical operations.
 * Any system (kernel, navigation, storage, services) can call setLoading()
 * to display a full-screen blocker with customizable title, subtitle, message, and progress.
 *
 * Discord-style design: title/subtitle at top, spinner in middle, progress bar, message at bottom.
 *
 * ✅ Gate-Free: LoadingProvider does not depend on kernel phases.
 * It only manages pure React state. Synchronous initialization.
 * Must be mounted ABOVE AppKernelProvider so kernel can use it during bootstrap.
 * 
 * 🎯 CRITICAL: Uses useLayoutEffect to ensure splash screen renders immediately
 * during app startup (before async bootstrap tasks). This prevents blank screen
 * during kernel initialization.
 */

export interface LoadingState {
  isLoading: boolean;
  title?: string; // e.g., "D&D Toolkit"
  subtitle?: string; // e.g., "Loading App"
  message?: string; // Subtle fun text at bottom
  progress?: number; // 0-100
  showProgress?: boolean; // Toggle progress bar visibility (default: true)
  decorativeElement?: React.ReactNode;
}

interface LoadingContextValue extends LoadingState {
  setLoading: (state: boolean | Partial<Omit<LoadingState, 'isLoading'>>) => void;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  // Start with splash showing - kernel will hide it when appReady
  // This ensures splash is visible during bootstrap regardless of timing
  const [state, setState] = useState<LoadingState>({ 
    isLoading: true,
    title: 'D&D Toolkit',
    subtitle: 'Loading App',
    message: 'Preparing your world...',
  });

  const setLoading = useCallback((newState: boolean | Partial<Omit<LoadingState, 'isLoading'>>) => {
    if (typeof newState === 'boolean') {
      setState(newState ? { isLoading: true } : { isLoading: false });
    } else {
      setState({ isLoading: true, ...newState });
    }
  }, []);

  // Force immediate DOM commit of initial loading state before browser paints
  // This ensures splash screen appears instantly, not 4+ seconds into bootstrap
  useLayoutEffect(() => {
    console.log('[bootstrap] 📺 LoadingProvider mounted — splash screen rendering immediately');
    // Trigger a synchronous state update to force React to commit the DOM
    // before async bootstrap code runs
    setState(prev => ({ ...prev }));
  }, []);

  const value = useMemo<LoadingContextValue>(
    () => ({ ...state, setLoading }),
    [state, setLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoadingContext() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoadingContext must be used within LoadingProvider');
  }
  return ctx;
}
