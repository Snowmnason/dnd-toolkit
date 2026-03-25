import { SplashScreen } from '@/components/SplashScreen';
import { UIBlockerContext, UIBlockerContextValue, UIBlockerState } from '@/contexts/UIBlockerContext';
import { logger } from '@/lib/utils/logger';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

// Re-export so consumers can import useUIBlocker + UIBlockerState from either file.
export { useUIBlocker } from '@/contexts/UIBlockerContext';
export type { UIBlockerState } from '@/contexts/UIBlockerContext';

// ─── Provider + view + overlay ───────────────────────────────────────────────

/**
 * UIBlockerLayer
 *
 * Single root-level component that unifies three previously separate concerns:
 *
 * 1. **State provider** (was: LoadingProvider + loading-context.tsx)
 *    Manages isLoading, title, subtitle, message, progress, etc.
 *    Any system calls `useUIBlocker().setLoading(...)` to control the overlay.
 *
 * 2. **Positioning context** (was: UIBlockerLayer simple wrapper)
 *    Wraps children in a `position: 'relative'` View so absolute overlays
 *    (loading blocker, crash fallback) are bounded correctly.
 *
 * 3. **Loading overlay** (was: LoadingBlocker component)
 *    Renders the SplashScreen as an absolute full-screen overlay when
 *    isLoading is true. Zero runtime cost when hidden.
 *
 * Must be mounted ABOVE AppKernelProvider so the kernel can call
 * setLoading() during bootstrap before the app is ready.
 *
 * Starts with the splash visible — kernel calls setLoading(false)
 * via useKernelLoadingSync() when appReady becomes true.
 */
export function UIBlockerLayer({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UIBlockerState>({
    isLoading: true,
    title: 'D&D Toolkit',
    subtitle: 'Loading App',
    message: 'Preparing your world...',
  });

  const setLoading = useCallback(
    (newState: boolean | Partial<Omit<UIBlockerState, 'isLoading'>>) => {
      if (typeof newState === 'boolean') {
        // Preserve all existing display fields — only toggle isLoading.
        setState(prev => ({ ...prev, isLoading: newState }));
      } else {
        setState(prev => ({ ...prev, isLoading: true, ...newState }));
      }
    },
    [],
  );

  // Force an immediate DOM commit before the browser paints so the splash
  // appears instantly rather than after async bootstrap tasks complete.
  useLayoutEffect(() => {
    logger.category('ui').debug('UIBlockerLayer mounted — splash rendering immediately');
    setState(prev => ({ ...prev }));
  }, []);

  const value = useMemo<UIBlockerContextValue>(
    () => ({ ...state, setLoading }),
    [state, setLoading],
  );

  return (
    <UIBlockerContext.Provider value={value}>
      {/* position: relative gives absolute-positioned overlays a bounded parent */}
      <View style={{ position: 'relative', flex: 1 }}>
        {/* Loading overlay — absolute, covers everything, zero cost when hidden */}
        {state.isLoading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
            }}
          >
            <SplashScreen
              title={state.title}
              subtitle={state.subtitle}
              message={state.message}
              progress={state.progress}
              showProgress={state.showProgress}
              decorativeElement={state.decorativeElement}
            />
          </View>
        )}
        {children}
      </View>
    </UIBlockerContext.Provider>
  );
}
