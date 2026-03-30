/**
 * Background Job Queue Module
 *
 * Exports for public API
 */

export { BackgroundJobQueue, getJobQueue } from "@/system/Jobs/background-job-queue";
export {
    NetworkRecoveryRetryJobManager,
    type NetworkRecoveryRetryJobConfig
} from "./core/network-recovery-retry-job";
export { JobsManager } from "./jobs-manager";

// ─── Sync Orchestrator ──────────────────────────────────────────────────
// Central coordination point for all data sync operations
export {
    createSyncJobHandler, drainOfflineQueue, executeSyncOperation,
    performDataSync, performDataSyncAll, type DataSyncResult, type FullSyncResult,
    type ISyncJobHandler, type QueueDrainResult, type SyncDirection, type SyncMode
} from "./core/sync/sync-orchestrator";

// ─── Sign-Out Job ───────────────────────────────────────────────────────
// Centralized sign-out orchestration (all logout cleanup logic)
export {
    performSignOutPhase2_ClearAndSignOut, type SignOutError,
    type SignOutPhase2Result, type SignOutSource
} from "./core/sign-out-job";

