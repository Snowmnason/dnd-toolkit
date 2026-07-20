/**
 * Analytics Service — Middleware between lib modules and System/Services breadcrumb-adapter
 *
 * This is the ONLY file in lib that imports from the breadcrumb adapter.
 * All other lib modules, hooks, components, and screens call these functions instead.
 *
 * Middleware Responsibilities:
 * - Precondition: Check network connectivity (breadcrumbs need to reach provider)
 * - Precondition: Check provider is initialized (adapter registered)
 * - Precondition: Check analytics consent before sending any data
 * - Single entry point to breadcrumb/analytics adapter
 *
 * Does NOT:
 * - Validate data (analytics modules validate their own events before calling here)
 * - Contain analytics domain logic (that stays in lib/analytics/)
 * - Manage consent state (that stays in lib/analytics/consent/)
 */

import { getAppConfig } from '@/config';
import { reportFault } from '@/lib/error/degrade/degrade-manager';
import { logger } from '@/lib/utils/logger';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import { getAdapter, isServiceReady } from '@/system/Services';
import { currentConsentLevel } from '@/type-definitions/analytics-types';
import type { BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/type-definitions/breadcrumb-queue-types.ts';
import { DegradeCapability } from '@/type-definitions/degrade';

export interface AnalyticsEventPayload {
  eventType: string;
  name: string;
  properties: Record<string, any>;
}

// ─── Precondition Checks ───────────────────────────────────────────

/**
 * Check if analytics sending preconditions are met.
 * Returns false if we should silently drop the data.
 */
function canSendAnalytics(): boolean {
    // 1. Network available?
    const networkStatus = NetworkDetection.getStatus();
    if (networkStatus.connectionQuality === ConnectionQuality.OFFLINE) {
        // Don't block — breadcrumb-queue has its own offline queue + exponential backoff.
        // Log for awareness but let the queue handle it.
        logger.category('analytics').debug('[analytics-service] Network offline — breadcrumb-queue will handle queueing');
    }

    // 2. Analytics consent? (requires at least 'basic' consent)
    if (currentConsentLevel === 'none') {
        // User opted out — respect that
        logger.category('analytics').debug('[analytics-service] Consent level is "none" — dropping analytics data');
        return false;
    }
    
    // 3. Provider initialized?
    if (!isServiceReady('analytics')) {
        // Service temporarily down (still initializing).
        // FUTURE: Queue for retry after initialization.
        // Current behavior: silently drop (acceptable since consent check already filters disabled services).
        logger.category('analytics').debug('[analytics-service] Analytics provider not ready — dropping data');
        reportFault(DegradeCapability.ANALYTICS, 'Analytics provider not ready');
        return false;
    }

    return true;
}

// ─── Breadcrumb Operations ─────────────────────────────────────────

/**
 * Get a registered breadcrumb provider adapter by name.
 * Checks provider readiness and consent before returning.
 * Internal precondition check before sending breadcrumbs.
 *
 * @param providerName - The name of the provider (e.g., 'sentry')
 * @returns The breadcrumb provider adapter, or null if preconditions not met
 */
function getBreadcrumbProvider(providerName: string): BreadcrumbProvider | null {
    if (!canSendAnalytics()) return null;

    try {
        return getAdapter(providerName);
    } catch (error) {
        // Provider not registered — log and return null
        logger.category('analytics').warn(`[analytics-service] Provider "${providerName}" not registered`, error);
        return null;
    }
}

/**
 * Send a batch of breadcrumbs through the configured provider.
 * Checks all preconditions (consent, network, provider ready) before sending.
 * Provider name is resolved from config automatically.
 *
 * @param breadcrumbs - The breadcrumbs to send
 * @returns Send result, or null if preconditions not met
 */
export async function sendBreadcrumbs(
    breadcrumbs: QueuedBreadcrumb[]
): Promise<BreadcrumbSendResult | null> {
    if (breadcrumbs.length === 0) return null;

    try {
        // Get provider name from config
        const config = getAppConfig();
        const providerName = config?.analytics?.breadcrumbs?.provider ?? 'sentry';

        // Get and validate provider through precondition checks
        const adapter = getBreadcrumbProvider(providerName);
        if (!adapter) return null;

        return await adapter.sendBatch(breadcrumbs);
    } catch (error) {
        // TODO: Should we queue failed breadcrumbs for retry? Or discard?
        // breadcrumb-queue handles its own retry logic, so this is a fallback.
        logger.category('analytics').warn(`[analytics-service] Failed to send breadcrumbs: ${error}`);
        return null;
    }
}

// ─── Analytics Event Operations ────────────────────────────────────

/**
 * Send a single analytics event through the configured provider.
 * Checks all preconditions (consent, network, provider ready) before sending.
 * Event is converted to breadcrumb format for transport via the provider adapter.
 *
 * Used by background jobs and synchronous event tracking.
 *
 * @param event - The analytics event to send
 * @throws Error if send fails (retryable failures like network/5xx)
 */
export async function sendAnalyticsEvent(event: AnalyticsEventPayload): Promise<void> {
    if (!canSendAnalytics()) {
        logger.category('analytics').debug('[analytics-service] Preconditions not met — dropping event');
        return;
    }

    try {
        // Get provider from config
        const config = getAppConfig();
        const providerName = config?.analytics?.breadcrumbs?.provider ?? 'sentry';

        // Get and validate provider through precondition checks
        const adapter = getBreadcrumbProvider(providerName);
        if (!adapter) {
            logger.category('analytics').debug('[analytics-service] No provider available — dropping event');
            return;
        }

        // Convert event to breadcrumb format for transmission
        const breadcrumb: QueuedBreadcrumb = {
            id: `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            category: 'analytics',
            level: 'info',
            message: event.name,
            data: {
                eventType: event.eventType,
                name: event.name,
                properties: event.properties,
            },
            fingerprint: `${event.eventType}:${event.name}`,
            retryCount: 0,
            maxRetries: 5,
        };

        // Send via provider adapter
        const result = await adapter.sendBatch([breadcrumb]);

        // Check if send was successful
        if (!result || result.sent.length === 0) {
            // Permanent failure (4xx) or other issue — log but don't throw
            if (result?.discard.length) {
                logger.category('analytics').debug('[analytics-service] Event permanently discarded by provider');
                return;
            }
            // Retryable failure — throw so job queue can retry
            throw new Error('[analytics-service] Failed to send event (will retry)');
        }

        logger.category('analytics').debug('[analytics-service] Event sent successfully');
    } catch (error) {
        logger.category('analytics').warn(`[analytics-service] Failed to send analytics event: ${error}`);
        throw error; // Re-throw so job queue retries with backoff
    }
}



