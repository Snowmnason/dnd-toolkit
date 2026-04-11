export type {
    AuthReplayMetadata, MutationOperation,
    MutationPersistence,
    // Phase 4 types
    NetworkErrorContract,
    OfflineQueueStats, OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation, SyncConflict,
    SyncResult
} from "./mutation-queue-types";

export { SyncStatus } from "./mutation-queue-types";

export type {
    EnqueueOptions,
    JobCompletedEvent,
    JobEventSubscriber,
    JobFailedEvent,
    JobHandler,
    JobHandlerContext,
    JobHandlerError,
    JobQueueConfig,
    JobRecord,
    JobStatus,
    QueueStatusItem,
    StorageAdapter
} from "./job-queue-types";

export {
    DATA_CLASSIFICATIONS,
    DataSensitivity,
    validateClassifications,
    type DataClassification
} from "./data-classification";

export type {
    EntitlementState,
    FeatureFlagState,
    FlagsSubscriber
} from "./featureFlagTypes";

export type {
    CacheEntry,
    CacheOptions,
    CachePriority,
    FetchFn,
    InvalidateOptions,
    QueryCacheConfig,
    RevalidationStrategy,
    UseQueryOptions,
    UseQueryState
} from "./storage-types";

export type {
    CacheSnapshot, CascadeMapping,
    ConditionalInvalidationResult,
    ConditionalPredicate, DeferredExecutionResult, DeferredScheduleResult, EvictionResult, LRUCapacityConfig,
    LRUEntry, TransactionContext,
    TransactionResult
} from "./cache-invalidation";

export { CacheInvalidationError } from "./cache-invalidation";

export {
    DegradeCapability,
    type DegradeCapabilityState,
    type DegradeState,
    type DegradeSubscriber
} from './degrade';

export {
    JOB_TYPE_COLOR_TOKENS,
    type JobOperation,
    type JobOperationProviderState,
    type JobOperationUpdate
} from './job-operation';

export type {
    ExecutionContext, ExternalLinkOptions, GuardPipelineProfile,
    NavigationContext,
    NavigationDecision, NavigationExecutionResult, NavigationGuardConfig,
    NavigationPolicyMode,
    NavigationRequest,
    NavigationTransaction,
    NavigationUiInstruction,
    Platform, TransportResult
} from './transport-types';

