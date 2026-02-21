/**
 * Analytics Exporters Module
 * Provides pluggable exporter architecture for multi-backend analytics
 */

import { AnalyticsConsent } from '@/lib/analytics/consent';
import { getConsentCategoryForEvent, shouldEmitEvent } from '@/lib/analytics/consent-gating';
import { getAppConfig } from '@/lib/config/loader';
import { logger } from '@/lib/utils/logger';

/**
 * Analytics event to be exported to backends
 */
export interface AnalyticsEvent {
  id: string; // UUID
  timestamp: number; // ms since epoch
  type: string; // 'pageview', 'event', 'error', 'performance', 'custom'
  name: string; // Event name ('user_signup', 'api_error', etc.)
  category?: string; // 'navigation', 'commerce', 'social', 'custom'
  level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal'; // Severity
  userId?: string; // Who did this
  sessionId?: string; // Session context
  properties: Record<string, unknown>; // Event-specific data
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number; // ms
    metric?: string; // FCP, LCP, INP, etc.
  };
}

/**
 * Context available to exporters during dispatch
 */
export interface ExportContext {
  offline?: boolean; // Is app offline?
  platform?: 'web' | 'ios' | 'android' | 'desktop';
  appVersion?: string;
  retryCount?: number;
  previousError?: Error;
}

/**
 * Pluggable exporter interface
 * Implement this to create custom analytics exporters
 */
export interface AnalyticsExporter {
  name: string; // 'sentry', 'mixpanel', 'custom-dashboard'
  version?: string; // '1.0.0'
  requiredEvents?: string[]; // Event types this exporter handles (whitelist)
  optionalEvents?: string[]; // Additional events if available (optional)

  /**
   * Export event to backend
   * Should not throw; errors handled by dispatch caller
   */
  export(event: AnalyticsEvent, context?: ExportContext): Promise<void>;

  /**
   * Optional lifecycle hook for initialization
   */
  initialize?(): Promise<void>;

  /**
   * Optional validation for exporter-specific schema
   * Global validation happens before this; use for backend-specific checks
   */
  validate?(event: AnalyticsEvent): boolean;

  /**
   * Check if exporter is enabled (usually via feature flag)
   */
  isEnabled?(): boolean;
}

/**
 * Validation result after event checking
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Global validation for all events
 * Checks required fields: id, timestamp, type, name, properties
 */
function validateEventGlobal(event: AnalyticsEvent): ValidationResult {
  const errors: string[] = [];

  if (!event.id || typeof event.id !== 'string') {
    errors.push('Event id must be a non-empty string');
  }

  if (!Number.isFinite(event.timestamp) || event.timestamp <= 0) {
    errors.push('Event timestamp must be a valid ms since epoch');
  }

  if (!event.type || typeof event.type !== 'string') {
    errors.push('Event type must be a non-empty string');
  }

  if (!event.name || typeof event.name !== 'string') {
    errors.push('Event name must be a non-empty string');
  }

  if (!event.properties || typeof event.properties !== 'object' || Array.isArray(event.properties)) {
    errors.push('Event properties must be a non-null object');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Registry for managing analytics exporters
 * Stores and retrieves exporters dynamically
 */
export class ExporterRegistry {
  private _exporters: Map<string, AnalyticsExporter> = new Map();

  /**
   * Register a new exporter
   */
  register(exporter: AnalyticsExporter): void {
    if (!exporter.name) {
      logger.warn('analytics', 'Cannot register exporter: name is required');
      return;
    }

    if (this._exporters.has(exporter.name)) {
      logger.warn(
        'analytics',
        `Exporter "${exporter.name}" already registered; overwriting`
      );
    }

    this._exporters.set(exporter.name, exporter);
    logger.info('analytics', `Exporter "${exporter.name}" registered`);
  }

  /**
   * Unregister exporter by name
   */
  unregister(name: string): void {
    if (this._exporters.delete(name)) {
      logger.info('analytics', `Exporter "${name}" unregistered`);
    } else {
      logger.warn('analytics', `Cannot unregister "${name}": not found`);
    }
  }

  /**
   * Get exporter by name
   */
  get(name: string): AnalyticsExporter | undefined {
    return this._exporters.get(name);
  }

  /**
   * Get all registered exporters
   */
  getAll(): AnalyticsExporter[] {
    return Array.from(this._exporters.values());
  }

  /**
   * Check if exporter is registered
   */
  isRegistered(name: string): boolean {
    return this._exporters.has(name);
  }

  /**
   * Clear all exporters (for testing)
   */
  clear(): void {
    this._exporters.clear();
    logger.debug('analytics', 'Exporter registry cleared');
  }

  /**
   * Get enabled exporters (checks isEnabled() if defined)
   */
  getEnabledExporters(): AnalyticsExporter[] {
    return this.getAll().filter((exporter) => {
      if (exporter.isEnabled && !exporter.isEnabled()) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filter exporters by event type
   * Returns exporters that accept this event type based on requiredEvents/optionalEvents
   */
  getExportersForEventType(eventType: string): AnalyticsExporter[] {
    return this.getEnabledExporters().filter((exporter) => {
      // If no filters defined, exporter accepts all events
      if (!exporter.requiredEvents && !exporter.optionalEvents) {
        return true;
      }

      // Check if event type is in required or optional events
      const isRequired = exporter.requiredEvents?.includes(eventType);
      const isOptional = exporter.optionalEvents?.includes(eventType);

      return !!(isRequired || isOptional);
    });
  }
}

/**
 * Global exporter registry singleton
 */
export const exporterRegistry = new ExporterRegistry();

/**
 * Helper to create ExportContext with runtime values
 * Auto-detects offline status from NetworkDetection if not provided
 */
export function createExportContext(
  offline?: boolean,
  appVersion?: string,
  platform?: ExportContext['platform']
): ExportContext {
  // Detect online status from network detection if not explicitly provided
  let isOffline = offline;
  if (offline === undefined) {
    try {
      // Dynamically import to avoid circular dependencies
      const { NetworkDetection } = require('@/lib/network/network-detection');
      const status = NetworkDetection.getStatus();
      isOffline = !status.isOnline;
      logger.debug(
        'analytics',
        `createExportContext: Network status=${status.isOnline ? 'online' : 'offline'}, quality=${status.connectionQuality}`
      );
    } catch (error) {
      // If dynamic import fails, default to online and log for diagnostics
      logger.debug(
        'analytics',
        'createExportContext: NetworkDetection import failed, defaulting to online',
        { error: String(error) },
      );
      isOffline = false; // Default to online
    }
  }

  return {
    offline: isOffline,
    platform,
    appVersion,
  };
}

/**
 * Validate event against global and per-exporter schema
 * Returns true if valid, logs warnings if invalid
 * Invalid events are dropped (never exported)
 */
export function validateEvent(
  event: AnalyticsEvent,
  exporters: AnalyticsExporter[]
): boolean {
  // Global validation
  const globalValidation = validateEventGlobal(event);
  if (!globalValidation.isValid) {
    logger.warn(
      'analytics',
      `Event validation failed: ${globalValidation.errors.join('; ')}`
    );
    return false;
  }

  // Per-exporter validation (each exporter's validate method)
  for (const exporter of exporters) {
    if (exporter.validate && !exporter.validate(event)) {
      logger.warn(
        'analytics',
        `Event validation failed for exporter "${exporter.name}"`
      );
    }
    // Note: Exporter validation failure doesn't drop event entirely;
    // it's up to exporter to handle during export
  }

  return true;
}

/**
 * Dispatch event to all enabled exporters
 * Async non-blocking with error isolation (Promise.allSettled)
 * Returns promise that resolves after all exports attempted
 *
 * **Error Isolation:**
 * - Each exporter is called independently via Promise.allSettled
 * - One exporter's failure doesn't block or affect others
 * - All failures are logged but never thrown (non-blocking)
 * - Exporter decides its own retry strategy (via #179, #70, etc)
 *
 * **Non-blocking behavior:**
 * - Caller should NOT await this function in hot paths
 * - Dispatch happens asynchronously in background
 * - All exporters attempted in parallel
 */
export async function dispatchEvent(
  event: AnalyticsEvent,
  context?: ExportContext
): Promise<void> {
  // Read dispatch configuration
  const config = (() => {
    try {
      return getAppConfig();
    } catch {
      return undefined;
    }
  })();

  const defaultDispatch = { async: true, debounceMs: 100, queueSize: 100, timeout: 5000 };
  const rawDispatch = config?.analytics?.dispatch ?? {};
  // Explicitly pick only known config properties to prevent prototype pollution
  const dispatchConfig = {
    async: rawDispatch.async ?? defaultDispatch.async,
    debounceMs: rawDispatch.debounceMs ?? defaultDispatch.debounceMs,
    queueSize: rawDispatch.queueSize ?? defaultDispatch.queueSize,
    timeout: rawDispatch.timeout ?? defaultDispatch.timeout,
  };

  // Enqueue event for debounced flush
  enqueueEvent({ event, context }, dispatchConfig);

  // If caller requested synchronous dispatch (async=false), flush immediately
  if (dispatchConfig.async === false) {
    await flushQueue(dispatchConfig);
  }
}

// Internal queue and flush logic
type Queued = { event: AnalyticsEvent; context?: ExportContext };
const pendingQueue: Queued[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

function enqueueEvent(item: Queued, cfg: { async: boolean; debounceMs: number; queueSize: number; timeout: number }) {
  // Enforce queue size (drop oldest)
  if (pendingQueue.length >= cfg.queueSize) {
    const dropped = pendingQueue.shift();
    logger.warn('analytics', 'Dispatch queue full, dropping oldest event', { dropped: dropped?.event?.name });
  }
  pendingQueue.push(item);

  // Schedule debounced flush
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Fire and forget the flush (errors handled internally)
    flushQueue(cfg).catch((e) => {
      logger.warn('analytics', 'Flush queue failed', { error: String(e) });
    });
  }, cfg.debounceMs);
}

async function flushQueue(cfg: { async: boolean; debounceMs: number; queueSize: number; timeout: number }) {
  if (isFlushing) return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (pendingQueue.length === 0) return;

  isFlushing = true;
  const batch = pendingQueue.splice(0, pendingQueue.length);

  try {
    for (const item of batch) {
      // Process each event independently but honor the timeout for each dispatch
      await dispatchSingleWithTimeout(item.event, item.context, cfg.timeout);
    }
  } finally {
    isFlushing = false;
  }
}

async function dispatchSingleWithTimeout(event: AnalyticsEvent, context: ExportContext | undefined, timeoutMs: number) {
  // Check consent gate before dispatching
  const consentCategory = getConsentCategoryForEvent(event.type, event.name);
  const consentLevel = AnalyticsConsent.getLevel();
  
  if (!shouldEmitEvent(consentCategory, consentLevel)) {
    logger.debug(
      'analytics',
      `Event '${event.name}' dropped (category=${consentCategory ?? 'unmapped'}, level=${consentLevel})`
    );
    return;
  }

  // Get enabled exporters for this event type
  const exporters = exporterRegistry.getExportersForEventType(event.type);

  if (exporters.length === 0) {
    logger.debug('analytics', `No exporters registered for event type "${event.type}", skipping dispatch`);
    return;
  }

  // Validate event globally and per-exporter
  if (!validateEvent(event, exporters)) {
    logger.warn('analytics', `Event "${event.name}" dropped due to validation failure`);
    return;
  }

  const exportPromises = exporters.map((exporter) =>
    exporter
      .export(event, context)
      .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('analytics', `Exporter "${exporter.name}" failed on event "${event.name}": ${errorMsg}`);
        throw error;
      })
  );

  // Wait for all exporters or timeout
  const waitAll = Promise.allSettled(exportPromises);
  const race = await Promise.race([
    waitAll,
    new Promise((res) => setTimeout(() => res('__timeout__'), timeoutMs)),
  ]);

  if (race === '__timeout__') {
    logger.warn('analytics', `Dispatch for event "${event.name}" timed out after ${timeoutMs}ms`);
    return;
  }

  const results = race as PromiseSettledResult<unknown>[];

  // Map results per exporter
  const exporterResults = exporters.map((exporter, index) => {
    // eslint-disable-next-line security/detect-object-injection
    const result = results[index];
    if (result && result.status === 'fulfilled') {
      return { name: exporter.name, status: 'success' as const };
    } else {
      return {
        name: exporter.name,
        status: 'failed' as const,
        error: result && 'reason' in result && result.reason instanceof Error ? result.reason.message : String(result?.reason),
      };
    }
  });

  const succeeded = exporterResults.filter((r) => r.status === 'success').length;
  const failed = exporterResults.filter((r) => r.status === 'failed').length;

  logger.debug('analytics', `Event "${event.name}" dispatch complete: ${succeeded}/${exporters.length} exporters succeeded${failed > 0 ? `, ${failed} failed` : ''}`);

  const failedResults = exporterResults.filter((r) => r.status === 'failed');
  if (failedResults.length > 0) {
    for (const result of failedResults) {
      logger.debug('analytics', `  - Exporter "${result.name}" failed: ${result.error}`);
    }
  }
}
