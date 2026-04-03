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

// Degradation Manager — domain wrapper for degradation reporting & hook subscriptions
export {
    clearLibResponses,
    getDegradationState,
    getDisplayCallbacks,
    getLibResponseCount,
    getPrimaryFault,
    isCapableOf,
    registerDegradeResponse,
    registerDisplayCallbacks,
    reportCrash,
    reportFault,
    reportRecovery,
    subscribeToDegradation,
    type FaultRecord
} from "./degrade/degrade-manager";

// Lib-level response handlers (registered during app init)
export { registerAllLibResponses } from "./degrade/lib-responses";

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

