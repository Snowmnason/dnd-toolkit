import { SplashScreen } from '@/components/SplashScreen';
import { UIBlockerContext, UIBlockerContextValue, UIBlockerState } from '@/contexts/UIBlockerContext';
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

// Re-export so consumers can import useUIBlocker + UIBlockerState from either file.
export { useUIBlocker } from '@/contexts/UIBlockerContext';
export type { UIBlockerState } from '@/contexts/UIBlockerContext';

// ─── Provider + view + overlay ───────────────────────────────────────────────

/**
 * UIBlockerLayer
 *
 * Thin shell — context provider + overlay renderer. Does not know about
 * kernel phases. Kernel sync is handled by useKernelLoadingSync() called
 * inside this layer (e.g. in RootLayoutContent).
 *
 * 1. **State provider** — provides UIBlockerContext (isLoading + setLoading).
 *    Any descendant calls `useUIBlocker().setLoading(...)` to control the overlay.
 *
 * 2. **Positioning context** — wraps children in a `position: 'relative'` View
 *    so absolute overlays are bounded correctly.
 *
 * 3. **Overlay renderer** — shows SplashScreen as a full-screen overlay when
 *    isLoading is true. Zero runtime cost when hidden.
 */
export function UIBlockerLayer({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UIBlockerState>({
    isLoading: true,
    showProgress: true,
    progress: 0,
    subtitle: 'Initializing App',
    message: 'Preparing systems...',
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
