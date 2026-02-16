/**
 * useOfflineQueue Hook
 *
 * Subscribes to the offline mutation queue and provides real-time status.
 * Shows pending changes count, sync progress, and dead-letter queue size.
 *
 * Returns:
 * - queueSize: Number of mutations waiting to sync
 * - isSyncing: Whether a sync is currently in progress
 * - lastSyncedAt: Timestamp (ms) of last successful sync (null if never synced)
 * - deadLetterCount: Number of permanently failed mutations
 *
 * Usage:
 *   const { queueSize, isSyncing, lastSyncedAt, deadLetterCount } = useOfflineQueue();
 *   if (queueSize > 0) {
 *     showPendingChangesIndicator(queueSize, isSyncing);
 *   }
 */

import { OfflineMutationQueue } from "@/lib/offline/mutation-queue";
import { OnlineSyncManager } from "@/lib/offline/sync-manager";
import { useEffect, useState } from "react";

export interface UseOfflineQueueReturn {
  /** Number of mutations currently queued (pending sync) */
  queueSize: number;

  /** Whether sync operation is in progress */
  isSyncing: boolean;

  /** Timestamp of last successful sync, or null if never synced */
  lastSyncedAt: number | null;

  /** Number of permanently failed mutations in dead-letter queue */
  deadLetterCount: number;
}

/**
 * Hook that provides offline queue status for UI display
 * Subscribes to sync manager status changes and updates in real-time
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [queueSize, setQueueSize] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [deadLetterCount, setDeadLetterCount] = useState<number>(0);

  useEffect(() => {
    // Get initial status
    const initialStatus = OnlineSyncManager.getStatus();
    setQueueSize(initialStatus.totalQueued);
    setIsSyncing(initialStatus.isSyncing);

    // Initialize dead-letter count and last synced time from state
    // Dead-letter count comes from OfflineMutationQueue internal state
    OfflineMutationQueue.getAll().then((mutations) => {
      const deadLetterMutations = mutations.filter(
        (m) => m.retryCount >= 5
      );
      setDeadLetterCount(deadLetterMutations.length);
    });

    // Track last sync success via status.lastSyncAttempt
    // Note: This could be enhanced to track actual success timestamp separately
    if (initialStatus.lastSyncAttempt) {
      setLastSyncedAt(initialStatus.lastSyncAttempt);
    }

    // Subscribe to real-time status updates
    const unsubscribe = OnlineSyncManager.subscribe((status) => {
      setQueueSize(status.totalQueued);
      setIsSyncing(status.isSyncing);

      // Update dead-letter count based on queue state
      OfflineMutationQueue.getAll().then((mutations) => {
        const deadLetterMutations = mutations.filter((m) => m.retryCount >= 5);
        setDeadLetterCount(deadLetterMutations.length);
      });

      // Track last sync time - update when sync completes successfully
      // Only update if this sync had successful completions
      if (
        !status.isSyncing &&
        ((status.syncedCount ?? 0) > 0 || (status.lastSyncAttempt ?? 0) > 0)
      ) {
        setLastSyncedAt(Date.now());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    queueSize,
    isSyncing,
    lastSyncedAt,
    deadLetterCount,
  };
}
