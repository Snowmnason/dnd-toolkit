/**
 * Offline Infrastructure
 *
 * Handles mutations made while offline:
 * - Persistent queue (SecureStorage)
 * - Automatic sync on reconnect
 * - Basic conflict detection
 * - Cache invalidation
 *
 * Integration:
 * 1. Call `OnlineSyncManager.initialize()` in AppKernel
 * 2. Register handlers via `registerSyncHandler(table, handler)` in your DB module
 * 3. Wrap mutations with `enqueueIfOffline()` to queue them when offline
 */

export { OfflineMutationQueue } from "./mutation-queue";
export {
    clearAllHandlers,
    executeSyncHandler,
    getRegisteredTables,
    getSyncHandler,
    registerSyncHandler,
    type SyncHandler,
    type SyncHandlerResult
} from "./sync-handlers";
export { OnlineSyncManager } from "./sync-manager";
export { useOfflineNotifications } from "./use-offline-notifications";
export { useSyncNotifications } from "./use-sync-notifications";
export { enqueueIfOffline } from "./utils";

export type {
    MutationOperation,
    OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation,
    SyncConflict,
    SyncResult
} from "./types";

export { SyncStatus } from "./types";

