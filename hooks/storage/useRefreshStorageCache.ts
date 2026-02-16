import { updateStorageCache } from '@/lib/storage';
import { useAppToast } from '@/lib/toast/app-toast-context';
import { logger } from '@/lib/utils/logger';
import { useCallback, useState } from 'react';

export interface UseRefreshStorageCacheReturn {
  isRefreshing: boolean;
  handleRefreshStorageCache: () => Promise<void>;
}

/**
 * Hook for refreshing app data (user profile + world access cache) with integrated toast notifications.
 * Displays toasts via global AppToastLayer.
 */
export function useRefreshStorageCache({
  isOffline,
}: {
  isOffline: boolean;
}): UseRefreshStorageCacheReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { show: showToast } = useAppToast();

  const handleRefreshStorageCache = useCallback(async () => {
    if (isRefreshing || isOffline) return;

    setIsRefreshing(true);
    showToast('Syncing latest data...', 'warning', 5000);
    const startTime = Date.now();

    try {
      await updateStorageCache.refreshEverything();

      logger.info('other', 'Force refresh completed successfully');

      const elapsedTime = Date.now() - startTime;
      const minDisplayTime = 2000;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      setTimeout(() => {
        showToast('App Data Synced', 'success', 4000);
      }, remainingTime);
    } catch (error: any) {
      logger.error('other', 'Force refresh failed:', error);
      showToast('Failed to sync data. Please try again.', 'error', 4000);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, isOffline, showToast]);

  return { isRefreshing, handleRefreshStorageCache };
}
