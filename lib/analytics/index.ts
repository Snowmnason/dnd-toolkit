import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { getAppConfig } from '../config/loader';
import { logger } from '../utils/logger';
import { AnalyticsConsent } from './consent';
import { categorizeError } from './error-categorization';
import { getThreshold, sanitizeError } from './utils';

type AnalyticsEventProps = Record<string, any>;

/**
 * Sanitize analytics properties before sending to Sentry
 * 
 * Security: Removes potentially sensitive fields that may contain:
 * - User input or system paths (message, stack)
 * - Raw error objects with detailed context
 * - Any string representations of errors
 * 
 * Only structured, predictable fields (error_name, error_code) are preserved
 * to prevent accidental leakage of sensitive information to analytics services.
 */
const sanitizeProps = (props?: AnalyticsEventProps | Error): AnalyticsEventProps | undefined => {
  if (!props) return undefined;
  if (props instanceof Error) {
    return sanitizeError(props) || {};
  }
  if (typeof props !== 'object') return undefined;

  const cloned: any = { ...(props as any) };

  // Remove common sensitive fields that may contain user data or system paths
  if (typeof cloned.message === 'string') delete cloned.message;
  if (typeof cloned.stack === 'string') delete cloned.stack;

  if (cloned.error instanceof Error) {
    const sanitized = sanitizeError(cloned.error);
    if (sanitized) {
      cloned.error = sanitized;
    } else {
      delete cloned.error;
    }
  } else if (typeof cloned.error === 'string') {
    delete cloned.error;
  }

  return cloned;
};

function isSentryEnabled(): boolean {
  try {
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn;
    const perfFlag = getAppConfig().features?.performanceMonitoring;
    return !!dsn && !!perfFlag;
  } catch {
    return false;
  }
}

function withTiming<T>(label: string, fn: () => Promise<T> | T, warnMs?: number): Promise<T> | T {
  const start = Date.now();
  const slowScreenThreshold = warnMs ?? getThreshold('slowScreenMs');
  
  const finish = (ok: boolean, extra?: any) => {
    const duration_ms = Date.now() - start;
    if (duration_ms > slowScreenThreshold) logger.warn('performance', `Slow operation: ${label} took ${duration_ms}ms`);
    if (isSentryEnabled() && AnalyticsConsent.isAllowed('performance')) {
      try {
        const errorCategory = extra?.error ? categorizeError(extra.error) : undefined;
        Sentry.addBreadcrumb({ 
          category: 'performance', 
          message: label, 
          data: { duration_ms, ok, error_category: errorCategory, ...extra }, 
          level: 'info' 
        });
      } catch {}
    }
  };

  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.then((val) => {
        finish(true);
        return val;
      }).catch((err) => {
        const error = sanitizeError(err);
        finish(false, error ? { error } : undefined);
        throw err;
      });
    } else {
      finish(true);
      return r;
    }
  } catch (err) {
    const error = sanitizeError(err);
    finish(false, error ? { error } : undefined);
    throw err;
  }
}

export const Analytics = {
  enabled(): boolean {
    return isSentryEnabled();
  },

  getThreshold,

  identify(user: { id?: string; username?: string } | null): void {
    if (!this.enabled()) return;
    try {
      if (user?.id) Sentry.setUser({ id: user.id, username: user.username });
      else Sentry.setUser(null);
    } catch {}
  },

  track(event: string, props?: AnalyticsEventProps): void {
    if (!this.enabled()) return;
    // Check consent before tracking
    if (event === 'screen_view' || event === 'component_usage') {
      if (!AnalyticsConsent.isAllowed('usage')) return;
    }
    if (event.startsWith('performance') || event === 'api_request') {
      if (!AnalyticsConsent.isAllowed('performance')) return;
    }
    
    const safeProps = sanitizeProps(props);
    try {
      Sentry.addBreadcrumb({
        category: 'analytics',
        message: event,
        data: safeProps,
        level: 'info',
      });
    } catch {}
  },

  trackComponentUsage(params: { component: string; action: string; detail?: AnalyticsEventProps }): void {
    const { component, action, detail } = params;
    this.track('component_usage', { component, action, ...detail });
  },

  withTiming,
};

export const Performance = {
  marks: new Map<string, number>(),
  // Maximum age for marks (5 minutes) to prevent memory leaks from abandoned measurements
  MAX_MARK_AGE_MS: 5 * 60 * 1000,

  /**
   * Start a performance measurement
   * If a mark with this label already exists, logs a warning and overwrites it
   * to prevent incorrect measurements from reused labels
   */
  startMeasure(label: string) {
    const existing = this.marks.get(label);
    if (existing) {
      logger.warn('performance', `Mark '${label}' already exists, overwriting (potential duplicate measurement)`);
    }
    this.marks.set(label, Date.now());
    this.cleanupOldMarks();
  },

  endMeasure(label: string, warnMs?: number) {
    const start = this.marks.get(label);
    if (!start) return;
    const duration = Date.now() - start;
    const slowScreenThreshold = warnMs ?? getThreshold('slowScreenMs');
    this.marks.delete(label);
    Analytics.track('performance_measure', { label, duration_ms: duration });
    if (duration > slowScreenThreshold) logger.warn('performance', `Slow operation: ${label} took ${duration}ms`);
  },

  /**
   * Clean up marks older than MAX_MARK_AGE_MS to prevent memory leaks
   * from abandoned measurements (e.g., unmounted components, errors)
   */
  cleanupOldMarks() {
    const now = Date.now();
    const staleLabels: string[] = [];
    
    this.marks.forEach((timestamp, label) => {
      if (now - timestamp > this.MAX_MARK_AGE_MS) {
        staleLabels.push(label);
      }
    });

    staleLabels.forEach(label => {
      logger.debug('performance', `Removing stale mark: ${label}`);
      this.marks.delete(label);
    });
  },

  useScreenDuration(screenName: string) {
    useEffect(() => {
      const label = `screen_load:${screenName}`;
      Performance.startMeasure(label);
      return () => Performance.endMeasure(label);
    }, [screenName]);
  },
};

export type FeatureBlockedReason = 'flag_disabled' | 'requires_premium' | 'beta_only';

export function trackFeatureBlocked(params: { feature: string; reason: FeatureBlockedReason }) {
  const { feature, reason } = params;
  Analytics.track('feature_blocked', { feature, reason });
}

// Export analytics utilities
export { AnalyticsConsent } from './consent';
export { categorizeError, type ErrorCategory } from './error-categorization';
export { sessionManager } from './session';
export { getThreshold, sanitizeError } from './utils';

export default Analytics;
