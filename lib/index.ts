/**
 * Lib Module - Central barrel exporter
 *
 * Exports all public utilities from lib/* subdirectories.
 * Each subdirectory has its own barrel export (index.ts).
 *
 * Import patterns:
 *   import { logger, AppKernel } from '@/lib';
 *   import { useAuthGuard, SignUpResult } from '@/lib/auth';
 *   import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
 */

// ===== Analytics =====
export * from "./analytics";

// ===== API =====
// Re-export everything except OfflineQueueStats (use offline's version instead)
export {
    APIClient,
    AuthLayer,
    CACHE_DEFAULTS,
    CircuitBreakerManager,
    CircuitBreakerOpenError,
    DEFAULT_THRESHOLDS,
    InterceptorManager,
    NetworkRecoveryManager,
    NetworkRecoveryRetryJobManager,
    UsersAPI,
    WorldsAPI, cleanupOfflineQueueReplay, createInviteAuthStrategy,
    createPublicAuthStrategy,
    createUserAuthStrategy, initializeOfflineQueueReplay, parseEndpoint,
    registerNetworkRecoveryHooks,
    type APIClientConfig, type APIUser,
    type APIWorld, type ApiErrorType,
    type AuthContext,
    type AuthStrategy,
    type CircuitStats,
    type CircuitThresholds,
    type MutationOptions,
    type NetworkRecoveryRetryJobConfig,
    type NotificationCallback,
    type QueryOptions,
    // Omit OfflineQueueStats and OfflineQueueConfig (see offline module instead)
    type QueuedRequestEntry, type RecoveryState,
    type RequestInterceptor,
    type UpdateUserRequest,
    type UpdateWorldRequest, type WorldMember
} from "./api";

// ===== Auth (Authentication & Authorization) =====
export * from "./auth";

// ===== Cache (Query & Data Caching) =====
export * from "./cache";

// ===== Config (App Configuration) =====
export * from "./config";

// ===== Database (Supabase & Queries) =====
export * from "./database";

// ===== Error Handling =====
export * from "./error";

// ===== Feature Flags =====
export * from "./feature-flags";

// ===== Kernel (Bootstrap & App Lifecycle) =====
export * from "./kernel";

// ===== Navigation (Route Configuration & Helpers) =====
export * from "./navigation";

// ===== Network (Detection & Status) =====
export * from "./network";

// ===== Offline Support =====
// Note: Both api and offline modules export OfflineQueueStats.
// Export offline's version (Phase 4 enhancements) to take precedence.
export * from "./offline";

// ===== Premium Features & Subscriptions =====
export * from "./premium";

// ===== Routing (Route Authentication) =====
export * from "./routing";

// ===== Schemas (Validation & Type Definitions) =====
export * from "./schemas";

// ===== Settings (User Settings & Account) =====
export * from "./settings";

// ===== Storage (Secure Storage & Encryption) =====
export * from "./storage";

// ===== Utils (Logging, Versioning, Performance) =====
export * from "./utils";
