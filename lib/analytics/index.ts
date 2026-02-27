/**
 * Analytics Module - Barrel Export
 *
 * Exports core analytics, performance tracking, and feature flag tracking APIs.
 * Business logic is separated into dedicated modules:
 * - `analytics-manager.ts` — Analytics object, identify, track
 * - `performance-manager.ts` — Performance object, withTiming, measurements
 * - `feature-tracking.ts` — Feature flag blocking events
 */

// Core analytics APIs
export { Analytics } from "./analytics-manager";
export { trackFeatureBlocked, type FeatureBlockedReason } from "./feature-tracking";
export { Performance, withTiming } from "./performance-manager";

// Consent and event management
export { AnalyticsConsent, type ConsentLevel } from "./consent";
export {
  DEFAULT_EVENT_CONSENT_MAPPING,
  getConsentCategoryForEvent,
  registerEventConsentMapping,
  shouldEmitEvent,
  type ConsentCategory
} from "./consent-gating";

// Error and consent payload handling
export { getCrashReportPayload } from "./consent-error-payload";

// Performance monitoring
export {
  OperationBaseline,
  PerformanceBaselineConfig,
  PerformanceBaselines,
  PerformanceBaselineService,
  performanceBaselineService,
  RegressionDetectionResult
} from "./performance/performance-baseline";

// Analytics buffering (Phase 1a - offline persistence)
export {
  analyticsBufferService,
  calculateExponentialBackoff,
  generateUUID,
  type AnalyticsBufferConfig,
  type AnalyticsBufferStats,
  type QueuedAnalyticsEvent
} from "./analytics-buffer";

// Analytics network integration
export {
  cleanupAnalyticsNetworkIntegration,
  flushAnalyticsQueue,
  handleAnalyticsConsentWithdrawal,
  initializeAnalyticsNetworkIntegration
} from "./analytics-network-integration";

// Breadcrumb queue (Phase 1a - offline persistence)
export { breadcrumbQueue, type BreadcrumbQueueStats } from "./breadcrumb-queue";

// Consent sync management
export { ConsentSyncQueue, type PendingConsentSync } from "./consent-sync-queue";

// Session manager
export { sessionManager } from "./session";

// Analytics utilities
export { getThreshold, sanitizeError } from "./utils";

// Variant tracking
export {
  trackVariantAssignment,
  trackVariantEngagement,
  trackVariantPerformance,
  type VariantAssignmentEvent,
  type VariantEngagementEvent,
  type VariantPerformanceEvent
} from "./variant-tracking";

// Exporter system
export {
  createExportContext,
  dispatchEvent,
  ExporterRegistry,
  exporterRegistry,
  validateEvent,
  type AnalyticsEvent,
  type AnalyticsExporter,
  type ExportContext
} from "./exporters/exporter-registry";



