/**
 * UIBlockerContext — thin context + hook, no SplashScreen/theme imports.
 *
 * Kept separate from UIBlockerLayer.tsx so that hooks/kernel can import
 * `useUIBlocker` without pulling in the SplashScreen → theme → ThemeProvider
 * → hooks/kernel cycle.
 *
 * Consumers:
 *   - UIBlockerLayer.tsx  (owns the context Provider + rendering)
 *   - use-kernel-loading-sync.tsx  (calls setLoading to dismiss splash)
 */
import React, { createContext, useContext } from 'react';

export interface UIBlockerState {
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  decorativeElement?: React.ReactNode;
}

export interface UIBlockerContextValue extends UIBlockerState {
  /**
   * Show or update the loading blocker.
   * - Pass `false` to hide.
   * - Pass `true` to show with current/default values.
   * - Pass a partial state object to show with specific values.
   */
  setLoading: (state: boolean | Partial<Omit<UIBlockerState, 'isLoading'>>) => void;
}

export const UIBlockerContext = createContext<UIBlockerContextValue | undefined>(undefined);

/**
 * Access UI blocker state and the `setLoading` dispatcher.
 * Must be called within a UIBlockerLayer.
 *
 * @example
 * const { setLoading } = useUIBlocker();
 * setLoading({ title: 'Saving...', progress: 60 });
 * setLoading(false); // dismiss
 */
export function useUIBlocker(): UIBlockerContextValue {
  const ctx = useContext(UIBlockerContext);
  if (!ctx) {
    throw new Error('useUIBlocker must be used within UIBlockerLayer');
  }
  return ctx;
}
