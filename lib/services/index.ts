/**
 * Services Initialization Barrel
 * Re-exports all service initialization, auth provider, and exporter utilities
 */

export { initializeServices } from './service-initializer';

export { SentryExporter } from './sentry/sentry-analytics-exporter';

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

