import { useUIBlocker } from '@/contexts/UIBlockerContext';
import { AuthStateManager } from '@/lib/auth/auth-state';
import type { PhaseProgress } from '@/lib/kernel/kernel-manager';
import { getKernelState, onKernelStateChange } from '@/lib/kernel/kernel-manager';
import { logger } from '@/lib/utils/logger';
import { getPhaseMessage } from '@/localization';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useAppKernel } from './use-app-kernel';

/**
 * Single hook that owns all kernel → UI splash/loading sync.
 *
 * 1. Subscribes to kernel state for phase progress (index, label, %).
 * 2. Pushes progress + subtitle into UIBlocker in real-time.
 * 3. Hides the overlay when appReady or on kernel error.
 *
 * Must be called inside UIBlockerLayer (requires UIBlockerContext).
 * Called once in RootLayoutContent.
 */
export function useKernelLoadingSync(): void {
  const { setLoading } = useUIBlocker();
  const kernel = useAppKernel();

  // Phase progress subscription (inlined from former usePhaseProgress)
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>(
    () => getKernelState().phaseProgress,
  );

  useEffect(() => {
    return onKernelStateChange((state) => {
      setPhaseProgress(state.phaseProgress);
    });
  }, []);

  // Sync progress into UIBlocker or hide on ready/error
  useLayoutEffect(() => {
    if (kernel.phases.appReady) {
      // Show final "ready" state briefly at 100% before hiding
      setLoading({
        progress: 100,
        subtitle: "Initializing App",
        message: "All systems ready!",
      });
      
      // Hide after 50ms — if sync is required, defer hide to useSyncSplash
      const hideTimer = setTimeout(() => {
        if (AuthStateManager.isSyncRequired()) {
          logger.category('bootstrap').debug('[KERNEL_BOOTSTRAP] Sync required — deferring hide to sync splash');
          return;
        }
        logger.category('bootstrap').debug('[KERNEL_BOOTSTRAP] App ready — hiding loading blocker');
        setLoading(false);
      }, 50);
      
      return () => clearTimeout(hideTimer);
    } else if (kernel.error) {
      logger.category('bootstrap').debug('[KERNEL_BOOTSTRAP] Kernel error — hiding loading blocker');
      setLoading(false);
    } else {
      setLoading({
        progress: phaseProgress.progressPercent,
        subtitle: "Initializing App",
        message: getPhaseMessage(phaseProgress.currentPhaseName),
      });
    }
  }, [kernel.phases.appReady, kernel.error, phaseProgress.progressPercent, phaseProgress.currentPhaseName, setLoading]);
}
