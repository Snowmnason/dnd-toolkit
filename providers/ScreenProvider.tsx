import { PanelNavigationProvider } from '@/hooks/navigation';
import { ReactNode } from 'react';

/**
 * ScreenProvider — Wrapper for screen-level effects
 *
 * Groups all screen-level providers that affect behavior across multiple screens.
 * Currently includes:
 * - PanelNavigationProvider: Manages dual-panel state for AppSplit screens on mobile
 *
 * Future additions:
 * - Screen transition animations
 * - Gesture handling (back swipe, drag-to-dismiss)
 * - Screen-level focus management
 * - Screen state persistence
 *
 * Usage:
 * ```tsx
 * <ScreenProvider>
 *   <Stack />
 * </ScreenProvider>
 * ```
 */

interface ScreenProviderProps {
  children: ReactNode;
}

export function ScreenProvider({ children }: ScreenProviderProps) {
  return (
    <PanelNavigationProvider>
      {children}
    </PanelNavigationProvider>
  );
}
