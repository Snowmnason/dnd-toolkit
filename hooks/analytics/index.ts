// Barrel export for analytics hooks
export { Analytics, sessionManager, useAnalytics } from "./use-analytics";
export { useAnalyticsConsent } from "./use-analytics-consent";
export type { UseAnalyticsConsentReturn } from "./use-analytics-consent";
export {
  _setAnalyticsBufferFlushing, getBreadcrumbQueueStatus, useAnalyticsBufferStatus,
  useBreadcrumbQueueStatus
} from "./use-analytics-status";
export type { AnalyticsBufferStatus, BreadcrumbQueueStatus } from "./use-analytics-status";
export { useCrashConsentReport } from "./use-crash-consent-report";
export { handleErrorReport } from "./useErrorReporting";

