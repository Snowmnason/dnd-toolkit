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
} from "./feature-gating";
export { createFeatureGatingGuard } from "./navigation-guards";
export { NetworkCascadeDetector } from "./network-cascade-detector";
export {
    executeRecoveryAction,
    isRecoveryActionAvailable,
    type RecoveryResult
} from "./recovery-actions";
export {
    AffectedFeature,
    createSafeModeState,
    getSafeModeDefinition,
    getSafeModeMessage,
    RecoveryAction,
    SAFE_MODE_DEFINITIONS,
    SAFE_MODE_MESSAGES,
    SafeModeLevel,
    SafeModeReason,
    type SafeModeConfig,
    type SafeModeState
} from "./safe-mode";
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

