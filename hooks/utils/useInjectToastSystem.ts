import { useAppToast } from '@/contexts/app-toast-context';
import { injectToastShowFunction } from '@/lib/utils/toast-queue';
import { useEffect } from 'react';

/**
 * Hook to inject the centralized AppToastContext show() function into the toast adapter
 * Must be called in app layout AFTER AppToastProvider is initialized
 * Runs once on mount to make the centralized toast system available to lib/ layers
 *
 * Usage:
 * ```tsx
 * // In app/_layout.tsx after AppToastProvider
 * function RootLayout() {
 *   useInjectToastSystem();
 *   return <App />;
 * }
 * ```
 */
export function useInjectToastSystem(): void {
  const { show } = useAppToast();

  useEffect(() => {
    // Inject the show function once on mount
    injectToastShowFunction(show);
  }, [show]);
}
