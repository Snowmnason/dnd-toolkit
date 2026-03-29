/**
 * useSyncSplash
 *
 * Runs full sync (re-auth + data sync) when triggered by:
 * 1. Listener: authPhase calls markSyncRequired() (STALE session) or
 *    performPostAuthSetup calls markSyncRequired() (login/reauth at runtime)
 * 2. Post-bootstrap flag: AuthStateManager.markPostBootstrapFullSync() called from auth-phase
 *
 * Both paths display identical 4-job UIBlocker splash:
 * 1. Re-Auth Job — restore session + post-auth setup
 * 2-4. Profile Sync, Worlds Sync, Feature Flags Sync (parallel)
 *
 * Flow:
 * - STALE bootstrap: authPhase calls markSyncRequired() → listener fires immediately → sync
 * - Post-bootstrap sync: authPhase calls markPostBootstrapFullSync() → checked when appReady fires → sync
 * - Login: performPostAuthSetup calls markSyncRequired() → listener fires → sync
 * - Splash shows 0% → runs 4 jobs with progress → 100% → hides
 *
 * Architecture: Single sync job executor, multiple triggers (listener + flag)
 */

import { useUIBlocker } from '@/contexts/UIBlockerContext';
import { AuthStateManager } from '@/lib/auth/auth-state';
import { logger } from '@/lib/utils/logger';
import { getPhaseMessage } from '@/localization';
import { STORAGE_KEYS } from '@/maps/storage-keys';
import { useEffect, useState } from 'react';
import { useAppKernel } from './use-app-kernel';

const TOTAL_JOBS = 4;

/**
 * Executes the full sync job with progress tracking and UIBlocker integration.
 * Extracted to eliminate duplication between listener-triggered and flag-triggered sync.
 */
async function executeSyncJob(
  setLoading: (config: any) => void,
  triggerSource: 'listener' | 'post-bootstrap'
): Promise<void> {
  let completed = 0;

  const onJobComplete = () => {
    completed++;
    setLoading({
      progress: Math.round((completed / TOTAL_JOBS) * 100),
      message: getPhaseMessage('sync'),
    });
    logger.category('auth').debug(`[SYNC_SPLASH] Job complete: ${completed}/${TOTAL_JOBS}`);
  };

  try {
    setLoading({
      subtitle: 'Synchronizing',
      progress: 0,
      message: getPhaseMessage('sync'),
    });

    // Get session tokens (needed for sync)
    const backend = (await import('@/lib/middleware/storage')).getPrivacyStorageBackend(STORAGE_KEYS.AUTH_SESSION);
    const tokens = await backend.getJSON<any>(STORAGE_KEYS.AUTH_SESSION);

    if (!tokens?.access_token) {
      logger.category('auth').warn(`[SYNC_SPLASH] No session tokens available for ${triggerSource} sync`);
      throw new Error('Session tokens not available');
    }

    // Call orchestrator with all 4 jobs
    const { performFullSync } = await import('@/lib/jobs/core/sync/sync-orchestrator');
    const result = await performFullSync(
      tokens,
      'bootstrap',
      () => onJobComplete()
    );

    if (!result.success) {
      logger.category('auth').warn(`[SYNC_SPLASH] ${triggerSource} sync completed with errors:`, result.errors);
    } else {
      logger.category('auth').info(`[SYNC_SPLASH] ${triggerSource} sync completed successfully`);
    }
  } catch (error) {
    logger.category('auth').warn(`[SYNC_SPLASH] ${triggerSource} sync failed:`, error);
  } finally {
    // Clear sync flags (both listener and post-bootstrap)
    AuthStateManager.clearSyncRequired();
    AuthStateManager.clearPostBootstrapFullSync();

    await new Promise<void>(r => setTimeout(r, 50));
    logger.category('auth').debug(`[SYNC_SPLASH] ${triggerSource} sync complete — hiding splash`);
    setLoading(false);
  }
}

export function useSyncSplash(): void {
  const { setLoading } = useUIBlocker();
  const kernel = useAppKernel();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!kernel.phases.appReady) {
      logger.category('auth').debug('[SYNC_SPLASH] Waiting for appReady');
      return;
    }

    // Check for post-bootstrap full sync request first
    const shouldDoPostBootstrapSync = AuthStateManager.isPostBootstrapFullSyncRequested();
    if (shouldDoPostBootstrapSync && !isRunning) {
      logger.category('auth').info('[SYNC_SPLASH] Post-bootstrap full sync triggered — starting sync splash');
      
      setIsRunning(true);
      executeSyncJob(setLoading, 'post-bootstrap').finally(() => {
        setIsRunning(false);
      });

      return; // Don't set up listener if post-bootstrap sync is running
    }

    // Subscribe to listener for markSyncRequired() calls (login, STALE reauth, etc.)
    const unsubscribe = AuthStateManager.onSyncRequired(() => {
      if (isRunning) {
        logger.category('auth').debug('[SYNC_SPLASH] Sync already running, skipping listener callback');
        return;
      }

      logger.category('auth').info('[SYNC_SPLASH] Sync required (listener fired) — starting sync splash');
      setIsRunning(true);

      executeSyncJob(setLoading, 'listener').finally(() => {
        setIsRunning(false);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [kernel.phases.appReady, setLoading, isRunning]);
}
