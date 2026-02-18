/**
 * Provider Adapter Interface & Factory
 *
 * Enables breadcrumb queue to work with any analytics provider (Sentry, Datadog, custom).
 * No provider-specific logic here — purely generic interfaces.
 */

/**
 * Represents a single breadcrumb queued for delivery
 * Provider-agnostic: no SDK-specific objects
 */
export interface QueuedBreadcrumb {
  id: string;
  timestamp: number;
  category: string; // 'http', 'ui', 'navigation', 'console', 'database', etc.
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  data?: Record<string, any>;
  fingerprint: string; // Client-computed hash (SHA1)
  retryCount: number;
  maxRetries: number;
  nextAttemptAt?: number; // Scheduled retry time (ms since epoch)
  metadata?: {
    offlineAt?: number; // When queued (ms since epoch)
    platform?: string; // 'web' | 'ios' | 'android'
    approxSize?: number; // Estimated bytes for storage tracking
  };
}

/**
 * Result of sendBatch() — describes which breadcrumbs were sent/failed
 */
export interface BreadcrumbSendResult {
  sent: string[]; // IDs successfully sent
  retry: string[]; // IDs to keep in queue for retry
  discard: string[]; // IDs rejected permanently (4xx, validation errors)
  retryAfterMs?: number; // If provider is rate-limited, when to retry (from 429 Retry-After)
}

/**
 * Decision on how to handle a specific HTTP response
 */
export interface BatchSendDecision {
  action: 'success' | 'retry' | 'discard' | 'rate_limited';
  retryAfterMs?: number; // Only for rate_limited action
  reason?: string; // For debugging
}

/**
 * Contract for delivering breadcrumbs to an analytics provider
 * Implement this to support a new provider (Sentry, Datadog, custom, etc.)
 */
export interface BreadcrumbProvider {
  name: string; // 'sentry', 'datadog', 'custom', etc.

  /**
   * Send a batch of breadcrumbs to the provider
   * Returns which breadcrumbs succeeded, should be retried, or discarded
   */
  sendBatch(breadcrumbs: QueuedBreadcrumb[]): Promise<BreadcrumbSendResult>;

  /**
   * Parse an HTTP response and classify as success/retry/discard/rate_limited
   * Enables provider-specific header parsing (e.g., Sentry's Retry-After)
   */
  parseHttpResponse(response: Response): BatchSendDecision;
}

/**
 * Factory for creating provider adapters
 * Maps provider name to adapter implementation
 */
const adapterRegistry = new Map<string, () => BreadcrumbProvider>();

/**
 * Register a provider adapter
 * Usage: registerAdapter('sentry', () => new SentryAdapter())
 */
export function registerAdapter(
  name: string,
  factory: () => BreadcrumbProvider
): void {
  adapterRegistry.set(name.toLowerCase(), factory);
}

/**
 * Get a provider adapter by name
 * Throws if provider not registered
 */
export function getAdapter(providerName: string): BreadcrumbProvider {
  const factory = adapterRegistry.get(providerName.toLowerCase());
  if (!factory) {
    throw new Error(
      `Provider adapter '${providerName}' not registered. Available: ${Array.from(adapterRegistry.keys()).join(', ')}`
    );
  }
  return factory();
}

/**
 * List all registered provider adapters
 */
export function listAdapters(): string[] {
  return Array.from(adapterRegistry.keys());
}
