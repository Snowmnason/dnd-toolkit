// ─── Storage Service (main middleware orchestrator) ─────────────────
export {
    checkStorageServiceHealth,
    getKeyInfo,
    persistRawValue,
    persistValue,
    removeValue,
    retrieveRawValue,
    retrieveValue,
    type StorageBackendType,
    type StorageHealthReport,
    type StorageReadOptions,
    type StorageRemoveOptions,
    type StorageWriteOptions
} from "./storage-service";

// ─── Privacy Routing ────────────────────────────────────────────────
export {
    classifyKey,
    clearAllUserData,
    getKeysBySensitivity,
    getPrivacyStorageBackend,
    getRetentionInfo,
    getSensitiveKeys,
    isSensitiveData,
    shouldUseSecureStorage
} from "./helpers/privacy";

// ─── Error Handling ─────────────────────────────────────────────────
export {
    batchStorageOperation,
    checkStorageHealth,
    classifyStorageError,
    handleStorageErrorGracefully,
    isStorageError,
    logStorageError,
    safeStorageGet,
    safeStorageGetJSON,
    safeStorageRemove,
    safeStorageSet,
    safeStorageSetJSON,
    shouldServeFallbackOnStorageError,
    type BatchStorageResult,
    type StorageErrorInfo,
    type StorageGracefulResult,
    type StorageOperation,
    type StorageOperationOptions
} from "./helpers/storage-error-handling";

// ─── Secure Storage Service (system layer wrapper) ─────────────────
export {
    clearAllSecureStorage,
    clearSecureStorageByPrefix,
    getAllSecureStorageKeys
} from "./secure-storage-service";

// ─── Analytics Storage Service (system layer wrapper) ───────────────
export {
    clearAnalyticsQueue,
    loadAnalyticsQueue,
    loadAnalyticsQueueJSON,
    persistAnalyticsQueue,
    persistAnalyticsQueueJSON
} from "./analytics-storage-service";

// ─── Performance Storage Service (system layer wrapper) ──────────────
export {
    loadPerformanceMetrics,
    persistPerformanceMetrics
} from "./performance-storage-service";

// ─── Query Cache public surface ─────────────────────────────────────
export { QueryCacheInternals } from "./helpers/query-cache/internals";
export { QueryCache } from "./helpers/query-cache/query-cache";

