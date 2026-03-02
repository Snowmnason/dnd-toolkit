// Error Manager — domain wrapper for all error tracking operations
export {
    addBreadcrumb,
    clearErrorUser,
    flushPendingErrors,
    isTrackingEnabled,
    reportError,
    reportMessage,
    setErrorUser,
    type ErrorBreadcrumb,
    type ErrorReportOptions,
    type ErrorUser
} from "./error-manager";

// Auth-specific errors — used by lib/auth module
export {
    AuthError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NetworkError,
    ProviderInitializationError,
    RateLimitError,
    UserNotFoundError
} from "./auth-errors";

export {
    enrichError,
    enrichErrors,
    extractErrorCode,
    isEnrichedError,
    type EnrichedError
} from "./error-enrichment";

export { NetworkCascadeDetector } from "./network-cascade-detector";
export {
    checkFeatureGating,
    getFeatureGatingReason,
    getGatedFeatures,
    type FeatureGatingStatus
} from "./safemode/feature-gating";
export {
    AffectedFeature,
    createSafeModeState,
    DEFAULT_SAFE_MODE_CONFIG,
    getSafeModeDefinition,
    getSafeModeMessage,
    RecoveryAction,
    SAFE_MODE_DEFINITIONS,
    SAFE_MODE_MESSAGES,
    SafeModeLevel,
    SafeModeReason,
    type SafeModeConfig,
    type SafeModeState
} from "./safemode/safe-mode";
export {
    assertValidErrorCode,
    getAllErrorCodes,
    getErrorCategory,
    getErrorCodesByCategory,
    getErrorSeverity,
    getErrorUserMessage,
    getRetryStrategy,
    isRecoverableError,
    isValidErrorCode,
    validateErrorCodeDev
} from "./validate-error-code";

