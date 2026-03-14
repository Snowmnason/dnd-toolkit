/**
 * Background Job Queue Module
 *
 * Exports for public API
 */

export { BackgroundJobQueue, getJobQueue } from "@/system/Jobs/background-job-queue";
export { JobsManager } from "./jobs-manager";
export {
    NetworkRecoveryRetryJobManager,
    type NetworkRecoveryRetryJobConfig
} from "./core/network-recovery-retry-job";

// ─── Sync Orchestrator ──────────────────────────────────────────────────
// Central coordination point for all data sync operations
export {
    executeSyncOperation,
    performDataSync,
    drainOfflineQueue,
    performDataSyncAll,
    createSyncJobHandler,
    type DataSyncResult,
    type QueueDrainResult,
    type FullSyncResult,
    type ISyncJobHandler,
    type SyncMode,
    type SyncDirection,
} from "./core/sync/sync-orchestrator";


