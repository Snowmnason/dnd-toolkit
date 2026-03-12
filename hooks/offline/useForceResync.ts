import { useAppToast } from '@/contexts/app-toast-context';
import { JobsManager } from '@/lib/jobs';
import { logger } from '@/lib/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseForceResyncReturn {
  isResyncing: boolean;
  handleForceResync: () => Promise<void>;
}

/**
 * Hook for forcing an offline queue sync with integrated toast notifications.
 * Uses JobsManager.performSync() for orchestrated sync of latest data + pending mutations.
 * Displays toasts via global AppToastLayer.
 */
export function useForceResync({ isOffline }: { isOffline: boolean }): UseForceResyncReturn {
  const [isResyncing, setIsResyncing] = useState(false);
  const { show: showToast } = useAppToast();
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleForceResync = useCallback(async () => {
    if (isResyncing || isOffline) return;

    setIsResyncing(true);
    showToast('Syncing latest data...', 'warning', 5000);
    const startTime = Date.now();

    try {
      // Use JobsManager orchestration: download latest, then upload pending mutations
      await JobsManager.performSync({ mode: 'manual', direction: 'download' });
      await JobsManager.performSync({ mode: 'manual', target: 'queue', direction: 'upload' });

      const elapsedTime = Date.now() - startTime;
      const minDisplayTime = 2000;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          showToast('App Data Synced', 'success', 4000);
        }
      }, remainingTime);
    } catch (error: any) {
      logger.category('storage').error('Force resync failed:', error);
      if (isMountedRef.current) {
        showToast('Failed to resync data. Please try again.', 'error', 4000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsResyncing(false);
      }
    }
  }, [isResyncing, isOffline, showToast]);

  return { isResyncing, handleForceResync };
}
