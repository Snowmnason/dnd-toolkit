import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { getAppConfig } from '../config/loader';
import { logger } from '../utils/logger';

type AnalyticsEventProps = Record<string, any>;

function isSentryEnabled(): boolean {
  try {
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn;
    const perfFlag = getAppConfig().features?.performanceMonitoring;
    return !!dsn && !!perfFlag;
  } catch {
    return false;
  }
}

export const Analytics = {
  enabled(): boolean {
    return isSentryEnabled();
  },

  identify(user: { id?: string; username?: string } | null): void {
    if (!this.enabled()) return;
    try {
      if (user?.id) Sentry.setUser({ id: user.id, username: user.username });
      else Sentry.setUser(null);
    } catch {}
  },

  track(event: string, props?: AnalyticsEventProps): void {
    if (!this.enabled()) return;
    try {
      Sentry.captureMessage(event, (scope) => {
        if (props) {
          scope.setContext('analytics', props);
        }
        scope.setLevel('info');
        return scope;
      });
    } catch {}
  },

  trackComponentUsage(params: { component: string; action: string; detail?: AnalyticsEventProps }): void {
    const { component, action, detail } = params;
    this.track('component_usage', { component, action, ...detail });
  },

  withTiming<T>(label: string, fn: () => Promise<T> | T, warnMs: number = 3000): Promise<T> | T {
    const start = Date.now();
    const finish = (ok: boolean, extra?: any) => {
      const duration_ms = Date.now() - start;
      if (duration_ms > warnMs) logger.warn('performance', `Slow operation: ${label} took ${duration_ms}ms`);
      if (isSentryEnabled()) {
        try {
          Sentry.addBreadcrumb({ category: 'performance', message: label, data: { duration_ms, ok, ...extra }, level: 'info' });
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
          finish(false, { error: (err as Error)?.message });
          throw err;
        });
      } else {
        finish(true);
        return r;
      }
    } catch (err) {
      finish(false, { error: (err as Error)?.message });
      throw err;
    }
  },
};

export const Performance = {
  marks: new Map<string, number>(),

  startMeasure(label: string) {
    this.marks.set(label, Date.now());
  },

  endMeasure(label: string, warnMs: number = 3000) {
    const start = this.marks.get(label);
    if (!start) return;
    const duration = Date.now() - start;
    this.marks.delete(label);
    Analytics.track('performance_measure', { label, duration_ms: duration });
    if (duration > warnMs) logger.warn('performance', `Slow operation: ${label} took ${duration}ms`);
  },

  useScreenLoadTime(screenName: string) {
    useEffect(() => {
      const label = `screen_load:${screenName}`;
      Performance.startMeasure(label);
      return () => Performance.endMeasure(label);
    }, [screenName]);
  },
};

export type FeatureBlockedReason = 'flag_disabled' | 'requires_premium' | 'beta_only';

export function trackFeatureBlocked(params: { feature: string; reason: FeatureBlockedReason; userId?: string | null }) {
  const { feature, reason, userId } = params;
  Analytics.track('feature_blocked', { feature, reason, userId: userId || undefined });
}

export default Analytics;
