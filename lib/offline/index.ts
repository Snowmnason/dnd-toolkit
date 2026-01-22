/**
 * Offline Infrastructure
 *
 * Handles mutations made while offline:
 * - Persistent queue (SecureStorage)
 * - Automatic sync on reconnect
 * - Basic conflict detection
 * - Cache invalidation
 */

export { OfflineMutationQueue } from "./mutation-queue";
export { OnlineSyncManager } from "./sync-manager";
export { enqueueIfOffline } from "./utils";

export type {
    MutationOperation,
    OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation,
    SyncConflict,
    SyncResult,
    SyncStatus
} from "./types";

