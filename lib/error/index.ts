export {
    enrichError,
    enrichErrors,
    extractErrorCode,
    isEnrichedError,
    type EnrichedError
} from "./error-enrichment";

export {
    checkFeatureGating,
    getFeatureGatingReason,
    getGatedFeatures,
    type FeatureGatingStatus
} from "./safemode/feature-gating";
export { createFeatureGatingGuard } from "./safemode/navigation-guards";
export { NetworkCascadeDetector } from "./network-cascade-detector";
export {
    executeRecoveryAction,
    isRecoveryActionAvailable,
    type RecoveryResult
} from "./safemode/recovery-actions";
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

