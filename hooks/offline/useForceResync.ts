import { OnlineSyncManager } from '@/lib/offline/sync-manager';
import { useAppToast } from '@/lib/toast/app-toast-context';
import { logger } from '@/lib/utils/logger';
import { useCallback, useState } from 'react';

export interface UseForceResyncReturn {
  isResyncing: boolean;
  handleForceResync: () => Promise<void>;
}

/**
 * Hook for forcing an offline queue sync with integrated toast notifications.
 * Encapsulates all sync logic and displays toasts via global AppToastLayer.
 */
export function useForceResync({ isOffline }: { isOffline: boolean }): UseForceResyncReturn {
  const [isResyncing, setIsResyncing] = useState(false);
  const { show: showToast } = useAppToast();

  const handleForceResync = useCallback(async () => {
    if (isResyncing || isOffline) return;

    setIsResyncing(true);
    showToast('Syncing latest data...', 'warning', 5000);
    const startTime = Date.now();

    try {
      await OnlineSyncManager.syncAll();

      const elapsedTime = Date.now() - startTime;
      const minDisplayTime = 2000;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      setTimeout(() => {
        showToast('App Data Synced', 'success', 4000);
      }, remainingTime);
    } catch (error: any) {
      logger.error('other', 'Force resync failed:', error);
      showToast('Failed to resync data. Please try again.', 'error', 4000);
    } finally {
      setIsResyncing(false);
    }
  }, [isResyncing, isOffline, showToast]);

  return { isResyncing, handleForceResync };
}
