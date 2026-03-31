/**
 * Services Initialization Barrel
 * Re-exports all service initialization, auth provider, and exporter utilities
 */

export { initializeServices } from './service-initializer';

export { SentryErrorTracker } from './sentry/sentry-error-tracker';

// Auth Provider Interface & Registration API
export {
  AuthError,
  createValidatedAuthProvider,
  EmailAlreadyExistsError,
  getAuthProvider,
  getAuthProviderSync,
  getProviderDebugInfo,
  InvalidCredentialsError,
  NetworkError,
  ProviderInitializationError,
  RateLimitError,
  registerAuthProvider,
  UserNotFoundError,
  type AuthProvider,
  type AuthResult,
  type Session
} from './auth-adapter';

// Supabase Auth Provider Implementation
export { SupabaseAuthProvider } from './supabase/supabase-auth-provider';

export {
  BreadcrumbProvider,
  BreadcrumbSendResult,
  getAdapter,
  listAdapters,
  QueuedBreadcrumb,
  registerAdapter
} from './analytics-adapter';

// Error Tracker Provider (Sentry/DataDog abstraction)
export {
  ErrorCaptureOptions,
  ErrorTrackerProvider,
  getErrorTracker,
  NoOpErrorTracker,
  registerErrorTracker,
  resetErrorTracker,
  SeverityLevel,
  TrackerBreadcrumb,
  TrackerUser,
  type SeverityLevel as ErrorSeverityLevel
} from './error-adapter';

// Database Provider (Supabase/PostgreSQL/Firebase abstraction)
export {
  DatabaseProvider,
  getDatabaseProvider,
  NoOpDatabaseProvider,
  QueryBuilder,
  QueryError,
  QueryResult,
  registerDatabaseProvider,
  resetDatabaseProvider
} from './database-adapter';

// Supabase Database Provider Implementation
export { SupabaseDatabaseProvider } from './supabase/supabase-database-provider';

// Supabase Initializer — database bootstrap (env vars, client, provider registration)
export { initializeSupabaseDatabaseProvider, resetSupabaseInitializer } from './supabase/supabase-initializer';
// Session Adapter — system-level session persistence (save/restore/clear)
export {
  SessionAdapter,
  type PersistedSessionData
} from './session-adapter';

// Service Status Tracking — visibility into service readiness
export {
  areCriticalServicesReady,
  getAllServiceStatuses,
  getServiceStatus,
  getServiceStatusDetail,
  isServiceReady,
  resetServiceStatus,
  updateServiceStatus,
  type ServiceReadiness,
  type ServiceStatus,
  type ServiceStatusDetail
} from './service-status';

// Backend Availability — provider-agnostic backend checks
export {
  getBackendHealthUrl,
  getBackendProjectUrl,
  isBackendAvailable,
} from './backend-availability';

