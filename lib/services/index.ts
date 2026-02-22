/**
 * Services Initialization Barrel
 * Re-exports all service initialization, auth provider, and exporter utilities
 */

export { initializeServices } from './service-initializer';

export { SentryExporter } from './sentry/sentry-analytics-exporter';
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
} from './auth-provider';

// Supabase Auth Provider Implementation
export { SupabaseAuthProvider } from './supabase/supabase-auth-provider';

export {
    createExportContext,
    dispatchEvent, ExporterRegistry, exporterRegistry, type AnalyticsEvent,
    type AnalyticsExporter,
    type ExportContext
} from '@/lib/analytics/exporters';

export {
    BreadcrumbProvider,
    BreadcrumbSendResult,
    getAdapter,
    listAdapters,
    QueuedBreadcrumb,
    registerAdapter
} from './breadcrumb-adapter';

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
} from './error-tracker';

