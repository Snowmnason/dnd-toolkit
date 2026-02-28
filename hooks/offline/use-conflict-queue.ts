/**
 * useConflictQueue Hook
 *
 * Integrates with ConflictQueueManager to display conflicts.
 * Shows one conflict at a time; UI user makes resolution choice.
 *
 * The manager is fed by sync-manager when conflicts are detected.
 * This hook subscribes to manager updates and displays modal.
 */

import {
  getConflictQueueManager,
  OfflineMutationQueue, OnlineSyncManager,
  type ConflictQueueItem,
} from "@/lib/offline";
import { logger } from "@/lib/utils";
import { useEffect, useState } from "react";

interface UseConflictQueueReturn {
  /** Current conflict being displayed (if any) */
  currentConflict: ConflictQueueItem | null;

  /** Is modal visible */
  isVisible: boolean;

  /** User chose to keep offline changes (retry) */
  resolveClientWins: () => Promise<void>;

  /** User chose to keep server version (discard) */
  resolveServerWins: () => Promise<void>;

  /** User chose to discard offline changes */
  resolveDiscard: () => Promise<void>;

  /** User cancelled without deciding */
  cancel: () => void;

  /** Total conflicts in queue */
  conflictCount: number;
}

export function useConflictQueue(): UseConflictQueueReturn {
  const [queue, setQueue] = useState<ConflictQueueItem[]>([]);

  // Subscribe to manager updates on mount
  useEffect(() => {
    const manager = getConflictQueueManager();

    // Initial queue state
    setQueue(manager.getQueue());

    // Subscribe to updates
    const unsubscribe = manager.subscribe((updatedQueue: ConflictQueueItem[]) => {
      setQueue([...updatedQueue]);
    });

    return unsubscribe;
  }, []);

  const currentConflict = queue[0] || null;
  const isVisible = queue.length > 0;

  // Resolve conflict with user choice
  const resolveConflict = async (
    choice: "client-wins" | "server-wins" | "discard",
  ) => {
    if (!currentConflict) return;

    const { id: conflictId, mutation } = currentConflict;

    logger.category("storage").info("Conflict resolved by user", {
      conflictId,
      mutationId: mutation.id,
      choice,
    });

    // Remove from conflict queue
    getConflictQueueManager().removeConflict(conflictId);

    // Apply resolution to mutation queue
    if (choice === "client-wins") {
      // Retry: keep mutation in queue, will retry on next sync
      await OfflineMutationQueue.markFailed(
        mutation.id,
        "Conflict resolved (user chose client-wins): retrying",
      );

      logger.category("storage").info("Mutation queued for retry", {
        mutationId: mutation.id,
      });

      // Trigger sync
      await OnlineSyncManager.syncAll();
    } else if (choice === "server-wins" || choice === "discard") {
      // Discard: remove mutation from queue (server won or user discarded)
      await OfflineMutationQueue.remove([mutation.id]);

      logger.category("storage").info("Mutation discarded", {
        mutationId: mutation.id,
        reason: choice === "server-wins" ? "server-wins" : "user-discard",
      });
    }
  };

  const cancel = () => {
    // Leave conflict in queue - can retry later or user can close modal
    logger.category("storage").info("Conflict resolution cancelled by user", {
      conflictId: currentConflict?.id,
    });
  };

  return {
    currentConflict,
    isVisible,
    resolveClientWins: () => resolveConflict("client-wins"),
    resolveServerWins: () => resolveConflict("server-wins"),
    resolveDiscard: () => resolveConflict("discard"),
    cancel,
    conflictCount: queue.length,
  };
}
