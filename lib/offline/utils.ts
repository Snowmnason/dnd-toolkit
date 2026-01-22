/**
 * Offline Utilities
 *
 * Helper functions for offline mutation handling
 */

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
export function getCacheLeyPatternForMutation(
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
 */
export function createOptimisticUpdate(
  operation: MutationOperation,
  payload: Record<string, any>,
): ((prev: any) => any) | undefined {
  switch (operation) {
    case "create":
      return (prev: any[]) => [...prev, payload];

    case "update":
      return (prev: any) => {
        if (Array.isArray(prev)) {
          return prev.map((item) =>
            item.id === payload.id ? { ...item, ...payload } : item,
          );
        }
        return { ...prev, ...payload };
      };

    case "delete":
      return (prev: any) => {
        if (Array.isArray(prev)) {
          return prev.filter((item) => item.id !== payload.id);
        }
        return null;
      };

    default:
      return undefined;
  }
}
