export {
    CACHE_CONFIG, CACHE_KEYS,
    CACHE_TAGS, getCacheConfig, getUserInvalidationTags,
    getWorldAccessInvalidationTags, getWorldInvalidationTags, INVALIDATION_PATTERNS
} from './cache-keys';
export { categorizeError, type ErrorCategory } from "./error-categorization";
export { ERROR_CODE_REFERENCE, type ErrorCodeReference } from "./error-code-reference";
export * from "./ERROR_CODES";
export {
    ConsentCategory,
    DEFAULT_EVENT_CONSENT_MAPPING
} from "./event-consent-mapping";
export {
    getStatusMessage,
    isClientError,
    isPermanentError,
    isServerError,
    isTransientError,
    statusToErrorCode
} from "./http-error-mapper";
export { STORAGE_KEYS } from './storage-keys';

export { getStorageDefaults } from './storage-defaults';

export { DEV_APPROVED_ORIGINS } from './trusted-origins';

