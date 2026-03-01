/**
 * Provider Adapter Interface & Factory
 *
 * Enables breadcrumb queue to work with any analytics provider (Sentry, Datadog, custom).
 * No provider-specific logic here — purely generic interfaces.
 *
 * Type contracts are defined in @/types/breadcrumb-queue-types.ts
 */

import type { BatchSendDecision, BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/types/breadcrumb-queue-types';

// Re-export for backward compatibility with @/system/Services barrel
export type { BatchSendDecision, BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb };

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
