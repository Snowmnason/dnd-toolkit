export { AuthLayer, type AuthContext, type AuthStrategy } from "./auth-layer";
export {
    APIClient,
    type APIClientConfig,
    type ApiErrorType,
    type MutationOptions,
    type QueryOptions
} from "./client-factory";
export { CACHE_DEFAULTS } from "./clients/defaults";
export {
    UsersAPI,
    type User as APIUser,
    type UpdateUserRequest
} from "./clients/users";
export {
    WorldsAPI,
    type World as APIWorld,
    type CreateWorldRequest,
    type UpdateWorldRequest,
    type WorldMember
} from "./clients/worlds";
export {
    createInviteAuthStrategy,
    createPublicAuthStrategy,
    createUserAuthStrategy
} from "./default-strategies";
export {
    InterceptorManager,
    parseEndpoint,
    type RequestInterceptor
} from "./interceptor";
export {
    CircuitBreakerManager,
    CircuitBreakerOpenError,
    DEFAULT_THRESHOLDS,
    type CircuitStats,
    type CircuitThresholds
} from "./resilience/circuit-breaker";

export {
    NetworkRecoveryManager,
    registerNetworkRecoveryHooks,
    type NotificationCallback,
    type RecoveryState
} from "./resilience/network-recovery";
export {
    NetworkRecoveryRetryJobManager,
    type NetworkRecoveryRetryJobConfig
} from "./resilience/network-recovery-retry-job";
export {
    OfflineQueueManager,
    type OfflineQueueConfig,
    type OfflineQueueStats,
    type QueuedRequestEntry
} from "./resilience/offline-queue";
export {
    cleanupOfflineQueueReplay,
    initializeOfflineQueueReplay
} from "./resilience/offline-queue-replay";

