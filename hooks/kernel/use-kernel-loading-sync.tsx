import { useUIBlocker } from '@/contexts/UIBlockerContext';
import type { PhaseProgress } from '@/lib/kernel/kernel-manager';
import { getKernelState, onKernelStateChange } from '@/lib/kernel/kernel-manager';
import { logger } from '@/lib/utils/logger';
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
      logger.category('bootstrap').debug('[KERNEL_BOOTSTRAP] App ready — hiding loading blocker');
      setLoading(false);
    } else if (kernel.error) {
      logger.category('bootstrap').debug('[KERNEL_BOOTSTRAP] Kernel error — hiding loading blocker');
      setLoading(false);
    } else {
      setLoading({
        progress: phaseProgress.progressPercent,
        subtitle: "Initializing App",
        message: phaseProgress.phaseLabel, // D&D themed messages go in footer
      });
    }
  }, [kernel.phases.appReady, kernel.error, phaseProgress.progressPercent, phaseProgress.phaseLabel, setLoading]);
}
