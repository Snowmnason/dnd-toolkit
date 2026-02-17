/**
 * Offline Infrastructure
 *
 * Handles mutations made while offline:
 * - Persistent queue (SecureStorage)
 * - Automatic sync on reconnect
 * - Basic conflict detection (Last-Write-Wins v1)
 * - Cache invalidation
 *
 * Integration:
 * 1. Call `OnlineSyncManager.initialize()` in AppKernel
 * 2. Register handlers via `registerSyncHandler(table, handler)` in your DB module
 * 3. Wrap mutations with `enqueueIfOffline()` to queue them when offline
 */

export {
    getConflictQueueManager,
    type ConflictQueueItem
} from "./conflict-queue-manager";
export {
    executeConflictResolution,
    resolveLastWriteWins,
    type ConflictResolutionResult
} from "./conflict-resolution";
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
export { useConflictQueue } from "./use-conflict-queue";
export { useOfflineNotifications } from "./use-offline-notifications";
export { useSyncNotifications } from "./use-sync-notifications";
export {
    enqueueIfOffline,
    isQueuedMutation,
    getCacheKeyPatternForMutation,
    createOptimisticUpdate,
    rollbackOptimisticUpdate
} from "./utils";

export type {
    MutationOperation,
    OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation,
    SyncConflict,
    SyncResult,
    // Phase 4 types
    NetworkErrorContract,
    OfflineQueueStats,
    RedactionRule,
    AuthReplayMetadata,
} from "./types";

export { SyncStatus } from "./types";

// Phase 4 Enhancements
export {
    Phase4Enhancements,
    RedactionManager,
    AuthReplayManager,
    NetworkErrorClassifier,
    BackoffScheduler,
    OfflineQueueStatsCollector,
    CircuitBreakerReplayManager,
    FetcherRegistryFallback,
} from "./offline-recovery";
