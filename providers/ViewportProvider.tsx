import { ReactNode } from 'react';
import { PlatformProvider, usePlatform } from './PlatformProvider';
import { ScaleProvider, useScale } from './ScaleProvider';
import { ScreenProvider } from './ScreenProvider';
import { ThemeProvider, UseTheme, type ThemeFamily, type ThemeMode } from './ThemeProvider';

/**
 * 🎨 ViewportProvider
 *
 * Combined provider for all visual/responsive app configuration.
 * Groups Theme, Scale, Platform, and Screen-level effects into a single provider hierarchy.
 *
 * Wraps:
 * - ThemeProvider: Theme family + mode management
 * - ScaleProvider: Responsive sizing tokens (window resize detection)
 * - PlatformProvider: Platform detection (iOS/Android/Web) + mobile breakpoint logic
 * - ScreenProvider: Screen-level effects (dual-panel navigation, gestures, focus management)
 *
 * All hooks remain individually available with the same names:
 * - UseTheme() — Access theme + setters
 * - useScale() — Access responsive sizing
 * - usePlatform() — Access platform info + breakpoint
 * - usePanelNavigation() — Access panel state (from ScreenProvider)
 *
 * Usage: Wrap AppKernelProvider with this provider, then SubscriptionProvider, then AppParamsProvider
 */

interface ViewportProviderProps {
  children: ReactNode;
}

export function ViewportProvider({ children }: ViewportProviderProps) {
  return (
    <ThemeProvider>
      <ScaleProvider>
        <PlatformProvider>
          <ScreenProvider>
            {children}
          </ScreenProvider>
        </PlatformProvider>
      </ScaleProvider>
    </ThemeProvider>
  );
}

// Re-export all hooks for convenience
export { usePlatform, useScale, UseTheme };
export type { ThemeFamily, ThemeMode };

