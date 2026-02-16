/**
 * Offline Utilities
 *
 * Helper functions for offline mutation handling
 */

import { QueryCache } from "@/lib/cache/query-cache";
import { NetworkDetection } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { OfflineMutationQueue } from "./mutation-queue";
import type { MutationOperation, QueuedMutation } from "./types";

/**
 * Wrapper to enqueue a mutation if offline, or execute immediately if online
 *
 * Usage in DB operations:
 * ```ts
 * export async function updateWorld(worldId: string, data: WorldUpdate) {
 *   return enqueueIfOffline(
 *     async () => {
 *       // Online path: directly call Supabase
 *       return await supabase
 *         .from('worlds')
 *         .update(data)
 *         .eq('id', worldId);
 *     },
 *     {
 *       operation: 'update',
 *       table: 'worlds',
 *       payload: data,
 *       invalidateTags: ['worlds', `world:${worldId}`]
 *     }
 *   );
 * }
 * ```
 *
 * @param onlineFn Function to execute when online
 * @param mutation Mutation metadata for offline queueing
 * @returns Promise with result from onlineFn or queued status
 */
export async function enqueueIfOffline<T>(
  onlineFn: () => Promise<T>,
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
): Promise<T | { queued: true; mutationId: string }> {
  const status = NetworkDetection.getStatus();
  const isOnline = status.isOnline && (status.isInternetReachable ?? true);

  if (isOnline) {
    try {
      logger
        .category("api")
        .debug(
          `Executing mutation online: ${mutation.operation} ${mutation.table}`,
        );
      return await onlineFn();
    } catch (error) {
      // If network error while "online", fall back to queueing
      const errorMsg = (error as Error).message;
      if (
        errorMsg.includes("network") ||
        errorMsg.includes("offline") ||
        errorMsg.includes("timeout")
      ) {
        logger
          .category("api")
          .warn("Network error detected, queuing mutation:", error);
        return queueMutation(mutation);
      }
      throw error;
    }
  } else {
    logger
      .category("api")
      .debug(
        `Offline: queuing mutation ${mutation.operation} ${mutation.table}`,
      );
    return queueMutation(mutation);
  }
}

/**
 * Internal: Queue a mutation for later sync
 */
async function queueMutation(
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
): Promise<{ queued: true; mutationId: string }> {
  const queued = await OfflineMutationQueue.enqueue(mutation);
  logger.category("storage").info(`Mutation queued: ${queued.id}`);
  return { queued: true, mutationId: queued.id };
}

/**
 * Check if a result is a queued mutation (vs actual data)
 */
export function isQueuedMutation(
  result: any,
): result is { queued: true; mutationId: string } {
  return (
    result && result.queued === true && typeof result.mutationId === "string"
  );
}

/**
 * Get the appropriate cache key pattern for a mutation
 * Helps with cache invalidation
 */
export function getCacheKeyPatternForMutation(
  table: string,
  resourceId?: string,
): string {
  if (resourceId) {
    return `${table}:*:${resourceId}`;
  }
  return `${table}:*`;
}

/**
 * Create optimistic update function for a mutation
 * Used with useMutation's optimisticUpdate option
 *
 * @param operation Type of mutation (create, update, delete)
 * @param payload Mutation payload containing data and optional ID
 * @param idField Name of the ID field in payload (defaults to 'id').
 *                For delete operations, this field must be present in payload.
 *                For update operations, this field is used to match existing items.
 * @returns Optimistic update function that transforms cached data, or undefined if not applicable
 *
 * Delete Payload Example: { id: 'world-123' } or { resourceId: 'char-456' }
 * Update Payload Example: { id: 'world-123', name: 'New Name' }
 * Create Payload Example: { name: 'New World', ... } (no id needed)
 */
export function createOptimisticUpdate(
  operation: MutationOperation,
  payload: Record<string, any>,
  idField: string = 'id',
): ((prev: any) => any) | undefined {
  switch (operation) {
    case "create":
      return (prev: any[]) => [...prev, payload];

    case "update": {
      /* eslint-disable-next-line security/detect-object-injection */
      const updateId = payload[idField];
      if (!updateId) {
        logger
          .category("storage")
          .warn(`Optimistic update skipped: payload missing ${idField} field`, {
            operation: "update",
            idField,
            payloadKeys: Object.keys(payload),
          });
        return undefined;
      }

      return (prev: any) => {
        if (Array.isArray(prev)) {
          return prev.map((item) =>
            /* eslint-disable-next-line security/detect-object-injection */
            item[idField] === updateId ? { ...item, ...payload } : item,
          );
        }
        return { ...prev, ...payload };
      };
    }

    case "delete": {
      /* eslint-disable-next-line security/detect-object-injection */
      const deleteId = payload[idField];
      if (!deleteId) {
        logger
          .category("storage")
          .warn(`Optimistic delete skipped: payload missing ${idField} field`, {
            operation: "delete",
            idField,
            payloadKeys: Object.keys(payload),
          });
        return undefined;
      }

      return (prev: any) => {
        if (Array.isArray(prev)) {
          return prev.filter(
            /* eslint-disable-next-line security/detect-object-injection */
            (item) => item[idField] !== deleteId,
          );
        }
        return null;
      };
    }

    default:
      return undefined;
  }
}

/**
 * Rollback an optimistic update by removing it from cache
 * 
 * Call this when a mutation fails permanently (4xx error or dead-letter).
 * Restores the original cached data by clearing cache entries that were
 * affected by the failed mutation.
 *
 * Usage with offline mutations:
 * ```ts
 * try {
 *   await enqueueIfOffline(
 *     async () => supabase.from('worlds').update(data).eq('id', worldId),
 *     {
 *       operation: 'update',
 *       table: 'worlds',
 *       payload: data,
 *       invalidateTags: ['worlds', `world:${worldId}`]
 *     }
 *   );
 * } catch (error) {
 *   // Mutation failed permanently - rollback optimistic update
 *   rollbackOptimisticUpdate('worlds', `world:${worldId}`);
 *   showErrorToast('Failed to update world');
 * }
 * ```
 *
 * @param optimisticId Unique ID of the optimistic update (usually the resource ID)
 * @param cacheKeyPattern Cache key pattern to invalidate (e.g., 'worlds' or 'world:123')
 *                        This clears the cache so fresh data will be fetched on next query
 */
export async function rollbackOptimisticUpdate(
  optimisticId: string,
  cacheKeyPattern: string,
): Promise<void> {
  try {
    logger
      .category("storage")
      .debug(`Rolling back optimistic update: ${optimisticId}`, {
        cacheKeyPattern,
      });

    // Invalidate the cache to force refetch of fresh data from server
    // This clears any cached data affected by the failed mutation
    await QueryCache.invalidateByTags([cacheKeyPattern]);

    logger
      .category("storage")
      .info(`Optimistic update rolled back: ${optimisticId}`, {
        cacheKeyPattern,
      });
  } catch (error) {
    logger
      .category("error")
      .warn(`Failed to rollback optimistic update: ${optimisticId}`, error);
  }
}

