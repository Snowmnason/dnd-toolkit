/**
 * Analytics Exporters Module
 * Provides pluggable exporter architecture for multi-backend analytics
 */

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

  if (event.properties !== null && typeof event.properties !== 'object') {
    errors.push('Event properties must be an object or null');
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
 */
export async function dispatchEvent(
  event: AnalyticsEvent,
  context?: ExportContext
): Promise<void> {
  // Get enabled exporters for this event type
  const exporters = exporterRegistry.getExportersForEventType(event.type);

  if (exporters.length === 0) {
    logger.debug(
      'analytics',
      `No exporters registered for event type "${event.type}"`
    );
    return;
  }

  // Validate event globally and per-exporter
  if (!validateEvent(event, exporters)) {
    logger.warn(
      'analytics',
      `Event dropped due to validation failure: ${event.name}`
    );
    return;
  }

  // Dispatch to all exporters in parallel with error isolation
  const exportPromises = exporters.map((exporter) =>
    exporter.export(event, context).catch((error) => {
      logger.error(
        'analytics',
        `Exporter "${exporter.name}" failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error; // Re-throw for allSettled to catch
    })
  );

  const results = await Promise.allSettled(exportPromises);

  // Log summary
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.debug(
    'analytics',
    `Event "${event.name}" dispatched: ${succeeded} succeeded, ${failed} failed`
  );
}
