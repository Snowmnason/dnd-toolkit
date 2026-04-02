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

import { reportFault } from '@/lib/error';
import { AnalyticsConsent } from '@/lib/analytics/consent/consent';
import { logger } from '@/lib/utils/logger';
import { DegradeCapability } from '@/type-definitions/degrade';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import { getAdapter, isServiceReady, listAdapters } from '@/system/Services';
import type { BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/type-definitions/breadcrumb-queue-types.ts';

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
    const consentLevel = AnalyticsConsent.getLevel();
    if (consentLevel === 'none') {
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
 *
 * @param providerName - The name of the provider (e.g., 'sentry')
 * @returns The breadcrumb provider adapter, or null if preconditions not met
 */
export function getBreadcrumbProvider(providerName: string): BreadcrumbProvider | null {
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
 * Send a batch of breadcrumbs through the named provider.
 * Checks all preconditions before sending.
 *
 * @param providerName - The name of the provider (e.g., 'sentry')
 * @param breadcrumbs - The breadcrumbs to send
 * @returns Send result, or null if preconditions not met
 */
export async function sendBreadcrumbs(
    providerName: string,
    breadcrumbs: QueuedBreadcrumb[]
): Promise<BreadcrumbSendResult | null> {
    if (!canSendAnalytics()) return null;
    if (breadcrumbs.length === 0) return null;

    try {
        const adapter = getAdapter(providerName);
        return await adapter.sendBatch(breadcrumbs);
    } catch (error) {
        // TODO: Should we queue failed breadcrumbs for retry? Or discard?
        // breadcrumb-queue handles its own retry logic, so this is a fallback.
        logger.category('analytics').warn(`[analytics-service] Failed to send breadcrumbs via "${providerName}": ${error}`);
        return null;
    }
}

/**
 * List all registered breadcrumb provider adapters.
 */
export function listBreadcrumbProviders(): string[] {
    return listAdapters();
}

// ─── Event Dispatch Operations ─────────────────────────────────────

/**
 * Dispatch an analytics event to all registered exporters.
 * Checks all preconditions before dispatching.
 * Fire-and-forget: doesn't block caller.
 *
 * @param event - The analytics event to dispatch
 * @param context - Export context with network status, consent level, etc.
 */
export async function dispatchAnalyticsEvent(
    event: any,
    context: any
): Promise<void> {
    if (!canSendAnalytics()) return;

    try {
        // Lazy require to break circular dependency
        const { dispatchEvent } = require('@/lib/analytics/exporters/exporter-registry');
        // Fire-and-forget: don't await or block
        Promise.resolve().then(() => {
            try {
                dispatchEvent(event, context);
            } catch (error) {
                logger.category('analytics').debug(`Failed to dispatch event: ${error}`);
            }
        });
    } catch (error) {
        logger.category('analytics').warn('[analytics-service] Failed to dispatch analytics event', error);
    }
}

/**
 * Create a context object for analytics event export.
 * Includes current network status and consent level.
 */
export function createAnalyticsExportContext(): any {
    try {
        // Lazy require to break circular dependency
        const { createExportContext } = require('@/lib/analytics/exporters/exporter-registry');
        return createExportContext();
    } catch (error) {
        logger.category('analytics').warn('[analytics-service] Failed to create export context', error);
        return null;
    }
}

