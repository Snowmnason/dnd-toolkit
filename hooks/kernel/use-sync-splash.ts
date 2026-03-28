/**
 * useSyncSplash
 *
 * Runs data sync (feature flags, profile, worlds) after kernel appReady,
 * displaying parallel job progress on the UIBlocker splash screen.
 *
 * Triggers only when AuthStateManager.isSyncRequired() is true — set during
 * login or stale re-auth in performPostAuthSetup. useKernelLoadingSync defers
 * its hide to this hook when sync is required.
 *
 * Both hooks use a 50ms delay on appReady, so they coordinate cleanly:
 * - useKernelLoadingSync: shows 100%, then after 50ms skips hiding if sync required
 * - useSyncSplash: after 50ms, takes over UIBlocker and shows sync progress
 */

import { useUIBlocker } from '@/contexts/UIBlockerContext';
import { AuthStateManager } from '@/lib/auth/auth-state';
import { logger } from '@/lib/utils/logger';
import { getPhaseMessage } from '@/localization';
import { useEffect } from 'react';
import { useAppKernel } from './use-app-kernel';

const SYNC_JOB_COUNT = 3;

export function useSyncSplash(): void {
  const { setLoading } = useUIBlocker();
  const kernel = useAppKernel();

  useEffect(() => {
    if (!kernel.phases.appReady) {
      logger.category('auth').debug('[SYNC_SPLASH] Waiting for appReady');
      return;
    }
    
    const syncRequired = AuthStateManager.isSyncRequired();
    if (!syncRequired) {
      logger.category('auth').debug('[SYNC_SPLASH] Sync not required — skipping');
      return;
    }

    logger.category('auth').debug('[SYNC_SPLASH] Starting sync splash');
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      let completed = 0;

      const onJobComplete = () => {
        completed++;
        if (!cancelled) {
          setLoading({
            progress: Math.round((completed / SYNC_JOB_COUNT) * 100),
            message: getPhaseMessage('sync'),
          });
        }
      };

      try {
        setLoading({
          subtitle: 'Synchronizing',
          progress: 0,
          message: getPhaseMessage('sync'),
        });

        const [
          { performFeatureFlagSync },
          { performProfileSync },
          { performWorldsSync },
        ] = await Promise.all([
          import('@/lib/jobs/core/sync/feature-flags-sync-job'),
          import('@/lib/jobs/core/sync/profile-sync-job'),
          import('@/lib/jobs/core/sync/worlds-sync-job'),
        ]);

        await Promise.allSettled([
          performFeatureFlagSync().then(onJobComplete),
          performProfileSync('automatic', 'download').then(onJobComplete),
          performWorldsSync('automatic', 'download').then(onJobComplete),
        ]);
      } catch (error) {
        logger.category('auth').warn('[SYNC_SPLASH] Sync failed:', error);
      } finally {
        AuthStateManager.clearSyncRequired();
        if (!cancelled) {
          await new Promise<void>(r => setTimeout(r, 50));
          if (!cancelled) {
            logger.category('auth').debug('[SYNC_SPLASH] Sync complete — hiding splash');
            setLoading(false);
          }
        }
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kernel.phases.appReady, setLoading]);
}
