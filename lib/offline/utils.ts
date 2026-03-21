/**
 * Offline Utilities
 *
 * Helper functions for offline mutation handling
 */

import { getNetworkStatus } from "@/lib/middleware/network";
import { QueryCache } from "@/lib/middleware/storage/helpers/query-cache";
import { logger } from "@/lib/utils/logger";
import type { MutationOperation, MutationPersistence, QueuedMutation } from "../../type-definitions/mutation-queue-types";
import { OfflineMutationQueue } from "./mutation-queue";

/**
 * Reduce payload based on persistence strategy (Phase 1b: Adaptive Payloads)
 * 
 * Strategies:
 * - `full`: Keep all fields (no reduction)
 * - `reduced`: Strip attachments, maps, GeoJSON, large arrays (recommended for 2G)
 * - `ephemeral`: Keep only core fields (IDs, timestamps, relationships)
 * 
 * @param payload Original mutation payload
 * @param persistence Persistence strategy to apply
 * @returns Reduced payload
 */
export function reducePayloadByPersistence(
  payload: Record<string, any>,
  persistence: MutationPersistence = "reduced",
): Record<string, any> {
  if (persistence === "full") {
    return payload; // No reduction
  }

  const fieldsToStrip = [
    "map_image_url",
    "map_data",
    "geoJson",
    "geojson",
    "geometry",
    "coordinates",
    "attachments",
    "files",
    "images",
    "thumbnails",
    "description",
    "notes",
    "details",
    "metadata",
    "extra",
  ];

  const reduced = { ...payload };

  if (persistence === "reduced") {
    // Strip large fields but keep core identifiers and timestamps
    fieldsToStrip.forEach((field) => {
      if (field in reduced) {
        // eslint-disable-next-line security/detect-object-injection
        delete reduced[field];
      }
    });
    // Add marker that attachments are pending
    if (payload.attachments) {
      reduced.attachmentsPending = true;
    }
  } else if (persistence === "ephemeral") {
    // Keep only IDs, timestamps, and basic relationships
    const coreFields = [
      "id",
      "world_id",
      "user_id",
      "owner_id",
      "parent_id",
      "created_at",
      "updated_at",
      "name",
      "status",
    ];
    const ephemeral: Record<string, any> = {};
    coreFields.forEach((field) => {
      if (field in reduced) {
        // eslint-disable-next-line security/detect-object-injection
        ephemeral[field] = reduced[field];
      }
    });
    return ephemeral;
  }

  return reduced;
}

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
 * With adaptive payload sizing (Phase 1b):
 * ```ts
 * // Request reduced payload on poor connections
 * return enqueueIfOffline(
 *   async () => supabase.from('worlds').update(data).eq('id', worldId),
 *   {
 *     operation: 'update',
 *     table: 'worlds',
 *     payload: data,
 *     persistence: 'reduced', // Strip maps, attachments on poor connections
 *     invalidateTags: ['worlds', `world:${worldId}`]
 *   }
 * );
 * ```
 *
 * @param onlineFn Function to execute when online
 * @param mutation Mutation metadata for offline queueing
 * @param mutation.persistence Payload reduction strategy: 'full'|'reduced'|'ephemeral' (default: 'reduced')
 * @returns Promise with result from onlineFn or queued status
 */
export async function enqueueIfOffline<T>(
  onlineFn: () => Promise<T>,
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
): Promise<T | { queued: true; mutationId: string }> {
  const status = getNetworkStatus();
  const isOnline = status.isOnline;

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
 * Applies payload reduction based on persistence strategy
 */
async function queueMutation(
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
): Promise<{ queued: true; mutationId: string }> {
  // Apply payload reduction if persistence strategy specified
  const persistenceStrategy = mutation.persistence || "reduced";
  const reducedPayload = reducePayloadByPersistence(
    mutation.payload,
    persistenceStrategy,
  );

  const mutationToQueue = {
    ...mutation,
    payload: reducedPayload,
  };

  const queued = await OfflineMutationQueue.enqueue(mutationToQueue);
  logger.category("storage").info(`Mutation queued: ${queued.id}`, {
    persistence: persistenceStrategy,
    originalSize: JSON.stringify(mutation.payload).length,
    reducedSize: JSON.stringify(reducedPayload).length,
  });
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
 * Rollback an optimistic update by invalidating cache tags
 * 
 * Call this when a mutation fails permanently (4xx error or dead-letter).
 * Invalidates cache tags so fresh data will be refetched from server,
 * effectively rolling back any optimistic UI updates.
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
 *   // Mutation failed permanently - rollback by invalidating tags
 *   rollbackOptimisticUpdate(worldId, ['worlds', `world:${worldId}`]);
 *   showErrorToast('Failed to update world');
 * }
 * ```
 *
 * @param optimisticId Unique ID of the optimistic update (usually the resource ID)
 * @param invalidateTags Cache tags to invalidate (same tags used in enqueueIfOffline.invalidateTags)
 *                       Each tag should match how the query was done (e.g., 'worlds', 'world:id', etc.).
 *                       Invalidating these tags forces a refetch of fresh server data.
 */
export async function rollbackOptimisticUpdate(
  optimisticId: string,
  invalidateTags: string[],
): Promise<void> {
  try {
    logger
      .category("storage")
      .debug(`Rolling back optimistic update: ${optimisticId}`, {
        invalidateTags,
      });

    // Invalidate the cache tags to force refetch of fresh data from server
    // This clears any cached data affected by the failed mutation (error recovery; ensure consistency)
    await QueryCache.invalidateByTags(invalidateTags, { strategy: 'immediate' });

    logger
      .category("storage")
      .info(`Optimistic update rolled back: ${optimisticId}`, {
        invalidateTags,
      });
  } catch (error) {
    logger
      .category("error")
      .warn(`Failed to rollback optimistic update: ${optimisticId}`, error);
  }
}

