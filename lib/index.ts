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
    CircuitBreakerOpenError, cleanupOfflineQueueReplay,
    createInviteAuthStrategy,
    createPublicAuthStrategy,
    createUserAuthStrategy, DEFAULT_THRESHOLDS, initializeOfflineQueueReplay, InterceptorManager,
    NetworkRecoveryManager,
    NetworkRecoveryRetryJobManager, parseEndpoint,
    registerNetworkRecoveryHooks, UsersAPI,
    WorldsAPI, type APIClientConfig, type ApiErrorType, type APIUser,
    type APIWorld, type AuthContext,
    type AuthStrategy,
    type CircuitStats,
    type CircuitThresholds,
    type MutationOptions,
    type NetworkRecoveryRetryJobConfig,
    type NotificationCallback,
    type QueryOptions,
    // Omit OfflineQueueStats and OfflineQueueConfig (see offline module instead)
    type QueuedRequestEntry,
    type RecoveryState,
    type RequestInterceptor,
    type UpdateUserRequest,
    type UpdateWorldRequest,
    type WorldMember
} from "./api";

// ===== Auth (Authentication & Authorization) =====
export * from "./auth";

// ===== Config (App Configuration) =====
export * from "../config";

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
export * from "./offline";

// ===== Premium Features & Subscriptions =====
export * from "./premium";

// ===== Settings (User Settings & Account) =====
export * from "./settings";

// ===== Storage (Secure Storage & Encryption) =====
export * from "./storage";

// ===== Utils (Logging, Versioning, Performance) =====
export * from "./utils";

