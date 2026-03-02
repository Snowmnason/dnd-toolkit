/**
 * Sentry Breadcrumb Adapter
 *
 * SENTRY-SPECIFIC implementation of BreadcrumbProvider interface.
 * All Sentry SDK hooks and Sentry-specific logic isolated here.
 *
 * This is the ONLY file that imports Sentry SDK.
 */

import { logger } from '@/lib/utils/logger';
import type { BatchSendDecision, BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/type-definitions/breadcrumb-queue-types.ts';
import * as Sentry from '@sentry/react-native';

/**
 * Sentry Breadcrumb Provider Adapter
 *
 * Handles:
 * - Converting QueuedBreadcrumb[] to Sentry envelope format
 * - Hooking Sentry.addBreadcrumb() to intercept and queue when offline
 * - Parsing Sentry-specific response headers (Retry-After, X-RateLimit-Remaining)
 * - Classifying HTTP responses (2xx, 429, 4xx, 5xx)
 */
export class SentryAdapter implements BreadcrumbProvider {
  name = 'sentry';
  private sentryDsn: string | null = null;
  private sentryEnvelopeEndpoint: string | null = null;
  private sentryPublicKey: string | null = null;

  constructor(dsn?: string) {
    this.sentryDsn = dsn || this._getSentryDsnFromConfig();
    if (this.sentryDsn) {
      this.sentryEnvelopeEndpoint = this._parseEnvelopeEndpoint(this.sentryDsn);
      this.sentryPublicKey = this._extractPublicKey(this.sentryDsn);
    }
  }

  /**
   * Extract public key from Sentry DSN
   * DSN format: https://<key>@<host>/projects/<org>/<project>
   */
  private _extractPublicKey(dsn: string): string | null {
    try {
      const url = new URL(dsn);
      return url.username || null;
    } catch {
      return null;
    }
  }

  /**
   * Build X-Sentry-Auth header for envelope request
   */
  private _buildSentryAuthHeader(): string | null {
    if (!this.sentryPublicKey) {
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const client = 'sentry.react-native/1.0';
    const sentry_version = 7;

    return `Sentry sentry_key=${this.sentryPublicKey}, sentry_version=${sentry_version}, sentry_client=${client}, sentry_timestamp=${timestamp}`;
  }

  /**
   * Parse Sentry DSN to extract envelope endpoint
   * DSN format: https://<key>@<host>/projects/<org>/<project>
   */
  private _parseEnvelopeEndpoint(dsn: string): string | null {
    try {
      const url = new URL(dsn);
      const projectId = url.pathname.split('/').pop();
      return `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
    } catch {
      logger.category('analytics').warn('SentryAdapter', 'Failed to parse DSN');
      return null;
    }
  }

  /**
   * Get Sentry DSN from app config or environment
   */
  private _getSentryDsnFromConfig(): string | null {
    try {
      // Try to get from Sentry SDK client
      const client = Sentry.getClient();
      if (client?.getOptions()?.dsn) {
        return client.getOptions().dsn as string;
      }
    } catch {
      // Sentry not configured yet
    }
    return null;
  }

  /**
   * Send batch of breadcrumbs to Sentry
   * Converts QueuedBreadcrumb to a minimal Sentry event with breadcrumbs array
   * and sends via envelope format to the endpoint
   */
  async sendBatch(breadcrumbs: QueuedBreadcrumb[]): Promise<BreadcrumbSendResult> {
    if (breadcrumbs.length === 0) {
      return { sent: [], retry: [], discard: [] };
    }

    if (!this.sentryEnvelopeEndpoint) {
      logger.category('analytics').warn('SentryAdapter', 'No Sentry endpoint configured');
      return {
        sent: [],
        retry: breadcrumbs.map((b) => b.id),
        discard: [],
      };
    }

    try {
      logger.category('analytics').analytics(
        'SentryAdapter',
        `Sending batch of ${breadcrumbs.length} breadcrumbs to Sentry endpoint`
      );

      // Convert QueuedBreadcrumb[] to Sentry breadcrumb format
      const sentryBreadcrumbs = breadcrumbs.map((qb) => ({
        timestamp: qb.timestamp / 1000, // Sentry expects seconds since epoch
        category: qb.category,
        level: qb.level,
        message: qb.message,
        data: qb.data,
      }));

      // Build minimal Sentry event with breadcrumbs array
      // This is a valid envelope item type that Sentry accepts
      const eventPayload = {
        breadcrumbs: sentryBreadcrumbs,
        timestamp: Date.now() / 1000,
        platform: 'react-native',
        // Minimal event to satisfy Sentry schema; breadcrumbs are the primary payload
      };

      // Sentry envelope format: header\n + item-header\n + item-payload
      const eventHeader = JSON.stringify({
        type: 'event',
        length: JSON.stringify(eventPayload).length,
      });

      const envelopeHeader = JSON.stringify({});

      const envelope = `${envelopeHeader}\n${eventHeader}\n${JSON.stringify(eventPayload)}`;

      // POST to Sentry envelope endpoint with authentication
      const authHeader = this._buildSentryAuthHeader();
      if (!authHeader) {
        logger.category('analytics').warn('SentryAdapter', 'No Sentry auth header available');
        return {
          sent: [],
          retry: breadcrumbs.map((b) => b.id),
          discard: [],
        };
      }

      const response = await fetch(this.sentryEnvelopeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': authHeader,
        },
        body: envelope,
      });

      // Parse response headers and classify decision
      const decision = this.parseHttpResponse(response);

      switch (decision.action) {
        case 'success':
          logger.category('analytics').analytics(
            'SentryAdapter',
            `Sent ${breadcrumbs.length} breadcrumbs successfully`
          );
          return {
            sent: breadcrumbs.map((b) => b.id),
            retry: [],
            discard: [],
          };

          case 'rate_limited':
            logger.category('analytics').warn(
              'SentryAdapter',
              `Rate limited: will retry after ${decision.retryAfterMs}ms`
            );
          return {
            sent: [],
            retry: breadcrumbs.map((b) => b.id),
            discard: [],
            retryAfterMs: decision.retryAfterMs,
          };

        case 'discard':
          logger.category('analytics').warn(
            'SentryAdapter',
            `Discarding batch: ${decision.reason}`
          );
          return {
            sent: [],
            retry: [],
            discard: breadcrumbs.map((b) => b.id),
          };

        case 'retry':
        default:
          logger.category('analytics').warn(
            'SentryAdapter',
            `Will retry: ${decision.reason}`
          );
          return {
            sent: [],
            retry: breadcrumbs.map((b) => b.id),
            discard: [],
          };
      }
    } catch (error) {
      logger.category('analytics').error('SentryAdapter', `sendBatch failed: ${error}`);
      // Network or other errors = retry
      return {
        sent: [],
        retry: breadcrumbs.map((b) => b.id),
        discard: [],
      };
    }
  }

  /**
   * Parse HTTP response from Sentry and classify decision
   * Handles Sentry-specific headers: Retry-After, X-RateLimit-Remaining
   */
  parseHttpResponse(response: Response): BatchSendDecision {
    const status = response.status;

    // 2xx = success
    if (status >= 200 && status < 300) {
      return { action: 'success' };
    }

    // 429 = rate-limited
    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let retryAfterMs = 60000; // default 60s

      if (retryAfter) {
        // Retry-After can be seconds or HTTP-date
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          retryAfterMs = seconds * 1000;
        } else {
          // Try parsing as HTTP-date
          const retryDate = new Date(retryAfter);
          if (!isNaN(retryDate.getTime())) {
            retryAfterMs = Math.max(0, retryDate.getTime() - Date.now());
          }
        }
      }

      logger.category('analytics').warn(
        'SentryAdapter',
        `Rate limited (429): retry after ${retryAfterMs}ms`
      );

      return { action: 'rate_limited', retryAfterMs };
    }

    // 4xx (other) = permanent failure / discard
    if (status >= 400 && status < 500) {
      logger.category('analytics').error('SentryAdapter', `Permanent error: ${status}`);
      return { action: 'discard', reason: `HTTP ${status}` };
    }

    // 5xx = server error, retry
    if (status >= 500) {
      logger.category('analytics').warn('SentryAdapter', `Server error (${status}): will retry`);
      return { action: 'retry', reason: `HTTP ${status}` };
    }

    // Unknown status, retry
    return { action: 'retry', reason: `Unknown status: ${status}` };
  }

}

/**
 * Create and register Sentry adapter globally
 * Call during app bootstrap (e.g., in AppKernel.initialize())
 */
export function registerSentryAdapter(dsn?: string): SentryAdapter {
  const { registerAdapter } = require('../breadcrumb-adapter');
  const adapter = new SentryAdapter(dsn);
  registerAdapter('sentry', () => adapter);
  logger.category('analytics').analytics('SentryAdapter', 'Registered as provider adapter');
  return adapter;
}

/**
 * Maps a Sentry SeverityLevel to a QueuedBreadcrumb level.
 * Sentry includes 'log' which has no direct equivalent — falls back to 'info'.
 */
function mapSentryLevelToQueueLevel(level: Sentry.SeverityLevel | undefined): QueuedBreadcrumb['level'] {
  switch (level) {
    case 'fatal':   return 'fatal';
    case 'error':   return 'error';
    case 'warning': return 'warning';
    case 'debug':   return 'debug';
    case 'log':
    case 'info':
    default:        return 'info';
  }
}

/**
 * Hook Sentry.addBreadcrumb() to enqueue when offline
 * Call after both breadcrumbQueue and SentryAdapter are initialized
 *
 * Usage:
 *   const adapter = registerSentryAdapter();
 *   hookSentryAddBreadcrumb(getNetworkStatus, breadcrumbQueue.enqueue);
 */
export function hookSentryAddBreadcrumb(
  getNetworkStatus: () => boolean, // returns isOnline
  enqueueFn: (breadcrumb: Omit<QueuedBreadcrumb, 'id' | 'fingerprint' | 'retryCount' | 'maxRetries'>) => Promise<QueuedBreadcrumb | null>
): () => void {
  // Store original Sentry.addBreadcrumb
  const originalAddBreadcrumb = Sentry.addBreadcrumb.bind(Sentry);

  // Create wrapper function that handles offline queuing
  const wrappedAddBreadcrumb = (breadcrumb: Sentry.Breadcrumb, hint?: Record<string, unknown>): void => {
    const isOnline = getNetworkStatus();

    if (!isOnline) {
      // Offline: queue the breadcrumb instead of sending immediately
      const queuedBreadcrumb = {
        timestamp: Date.now(),
        category: breadcrumb.category || 'default',
        level: mapSentryLevelToQueueLevel(breadcrumb.level),
        message: breadcrumb.message || JSON.stringify(breadcrumb),
        data: breadcrumb.data,
        metadata: {
          offlineAt: Date.now(),
          approxSize: JSON.stringify(breadcrumb).length,
        },
      };

      enqueueFn(queuedBreadcrumb)
        .then((queued) => {
          if (queued) {
            logger.category('analytics').debug('SentryAdapter', 'Breadcrumb queued (offline)');
          }
        })
        .catch((err) => {
          logger.category('analytics').warn('SentryAdapter', `Failed to queue breadcrumb: ${err}`);
          // Fallback: still call original (in-memory only)
          originalAddBreadcrumb(breadcrumb, hint);
        });
    } else {
      // Online: send immediately via original
      originalAddBreadcrumb(breadcrumb, hint);
    }
  };

  // Use Object.defineProperty to replace the read-only property
  try {
    Object.defineProperty(Sentry, 'addBreadcrumb', {
      value: wrappedAddBreadcrumb,
      writable: true,
      configurable: true,
    });
  } catch {
    logger.category('analytics').warn('SentryAdapter', 'Could not hook Sentry.addBreadcrumb (may be read-only)');
  }

  logger.category('analytics').analytics('SentryAdapter', 'Sentry.addBreadcrumb hook installed');

  // Return unsubscribe function
  return () => {
    try {
      Object.defineProperty(Sentry, 'addBreadcrumb', {
        value: originalAddBreadcrumb,
        writable: true,
        configurable: true,
      });
    } catch {
      // Ignore
    }
    logger.category('analytics').analytics('SentryAdapter', 'Sentry.addBreadcrumb hook removed');
  };
}
