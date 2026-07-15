// Barrel export for analytics hooks
export { Performance } from "@/lib/analytics/performance/performance-manager";
export { Analytics } from "@/managers/analytics/analytics-manager";
export { useAnalytics, useAnalyticsSession } from "./use-analytics";
export type { UseAnalyticsReturn } from "./use-analytics";
export { useAnalyticsConsent } from "./use-analytics-consent";
export type { UseAnalyticsConsentReturn } from "./use-analytics-consent";
export { useCrashConsentReport } from "./use-crash-consent-report";
export { handleErrorReport } from "./useErrorReporting";

