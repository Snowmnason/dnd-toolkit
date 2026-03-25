/**
 * Kernel Loading State Synchronization
 *
 * Syncs kernel bootstrap state with LoadingContext
 * - Shows loading blocker when kernel starts initialization
 * - Hides blocking when appReady becomes true
 * - Provides visual feedback during bootstrap phases
 *
 * Used in app/_layout.tsx to coordinate kernel phases with UI blocking
 */

import { useLoadingContext } from '@/contexts/loading-context';
import { logger } from '@/lib/utils/logger';
import { useEffect } from 'react';
import { useAppKernel } from './use-app-kernel';

export function useKernelLoadingSync(): void {
  const kernel = useAppKernel();
  const { setLoading } = useLoadingContext();

  useEffect(() => {
    console.log(`[ui] [KERNEL_LOADING_SYNC] Effect fired — appReady=${kernel.phases.appReady}, error=${!!kernel.error}`);

    // Primary goal: Hide loading blocker when kernel finishes (appReady = true)
    if (kernel.phases.appReady) {
      console.log('[ui] [KERNEL_LOADING_SYNC] App ready — calling setLoading(false)');
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
