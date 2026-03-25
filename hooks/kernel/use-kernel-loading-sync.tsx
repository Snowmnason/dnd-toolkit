/**
 * Kernel Loading State Synchronization
 *
 * Syncs kernel bootstrap state with UIBlockerLayer
 * - Hides the loading overlay when appReady becomes true
 * - Also hides on kernel error so the crash screen can render
 *
 * Used in app/_layout.tsx to coordinate kernel phases with the UI blocker
 */

import { useUIBlocker } from '@/contexts/UIBlockerContext';
import { logger } from '@/lib/utils/logger';
import { useEffect } from 'react';
import { useAppKernel } from './use-app-kernel';

export function useKernelLoadingSync(): void {
  const kernel = useAppKernel();
  const { setLoading } = useUIBlocker();

  useEffect(() => {
    logger
      .category('bootstrap')
      .debug(`[KERNEL_LOADING_SYNC] Effect fired — appReady=${kernel.phases.appReady}, error=${!!kernel.error}`);

    // Primary goal: Hide loading blocker when kernel finishes (appReady = true)
    if (kernel.phases.appReady) {
      logger
        .category('bootstrap')
        .debug('[KERNEL_LOADING_SYNC] App ready — hiding loading blocker');
      setLoading(false);
    }
    // If error occurs during bootstrap, also hide to let error screen show
    else if (kernel.error) {
      logger
        .category('bootstrap')
        .debug('[KERNEL_LOADING_SYNC] Kernel error - hiding loading blocker');
      setLoading(false);
    }
    // Otherwise keep the initial splash screen showing (initialized in LoadingContext)
  }, [kernel.phases.appReady, kernel.error, setLoading]);
}
