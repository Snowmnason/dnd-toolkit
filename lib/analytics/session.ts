/**
 * Session & User Retention Tracking
 * Tracks user sessions, duration, and engagement metrics
 */
import { getAppConfig } from '@/config';
import { logger } from '@/lib/utils';
import { AnalyticsConsent } from './consent/consent';
import { shouldEmitEvent } from './consent/consent-gating';

// Lazy import to break circular dependency with lib/services/index.ts
let cachedErrorTracker: any = null;
function getErrorTrackerLazy() {
  if (!cachedErrorTracker) {
    const { getErrorTracker } = require('@/lib/services');
    cachedErrorTracker = getErrorTracker();
  }
  return cachedErrorTracker;
}

interface SessionData {
  startedAt: number;
  userId?: string;
  screenViews: number;
  errorCount: number;
  lastActivityAt: number;
}

class SessionManager {
  private currentSession: SessionData | null = null;

  /**
   * Start a new session
   * If a session is already active, ends it before starting the new one
   */
  startSession(userId?: string): void {
    // End existing session if active
    if (this.currentSession) {
      logger.category('analytics').debug('Ending existing session before starting new one');
      this.endSession();
    }

    const now = Date.now();
    this.currentSession = {
      startedAt: now,
      userId,
      screenViews: 0,
      errorCount: 0,
      lastActivityAt: now,
    };

    this.trackEvent('session_started', {
      userId: userId || undefined,
      timestamp: now,
    });

    logger.category('analytics').analytics('Session started:', { userId });
  }

  /**
   * End current session and track metrics
   */
  endSession(): void {
    if (!this.currentSession) return;

    const now = Date.now();
    const duration = now - this.currentSession.startedAt;
    const durationMinutes = Math.round(duration / 60000);

    this.trackEvent('session_ended', {
      duration_ms: duration,
      duration_minutes: durationMinutes,
      screen_views: this.currentSession.screenViews,
      errors: this.currentSession.errorCount,
      userId: this.currentSession.userId || undefined,
    });

    logger.category('analytics').analytics('Session ended:', {
      durationMinutes,
      screenViews: this.currentSession.screenViews,
      errors: this.currentSession.errorCount,
    });

    this.currentSession = null;
  }

  /**
   * Track a screen view within the session
   */
  trackScreenView(screenName: string): void {
    if (this.currentSession) {
      this.currentSession.screenViews += 1;
      this.currentSession.lastActivityAt = Date.now();
    }
  }

  /**
   * Track an error within the session
   */
  trackError(): void {
    if (this.currentSession) {
      this.currentSession.errorCount += 1;
      this.currentSession.lastActivityAt = Date.now();
    }
  }

  /**
   * Get current session duration
   */
  getCurrentDuration(): number {
    if (!this.currentSession) return 0;
    return Date.now() - this.currentSession.startedAt;
  }

  /**
   * Check if session is still active (no activity > 30 min)
   */
  isSessionActive(): boolean {
    if (!this.currentSession) return false;
    const inactiveMs = Date.now() - this.currentSession.lastActivityAt;
    const thirtyMinutesMs = 30 * 60 * 1000;
    return inactiveMs < thirtyMinutesMs;
  }

  /**
   * Internal method to track session events to error tracker
   * Avoids circular dependency with Analytics module
   */
  private trackEvent(event: string, data?: Record<string, any>): void {
    try {
      const perfFlag = getAppConfig().features?.performanceMonitoring;
      if (!getErrorTrackerLazy().isEnabled() || !perfFlag) return;

      // Session lifecycle events are usage-level data (behavioral: when sessions start/end)
      // Require 'full' consent before sending to error tracker
      if (!shouldEmitEvent('usage', AnalyticsConsent.getLevel())) return;

      getErrorTrackerLazy().addBreadcrumb({
        category: 'analytics',
        message: event,
        data,
        level: 'info',
      });
    } catch (err) {
      logger.category('analytics').warn('Failed to track session event:', err);
    }
  }
}

export const sessionManager = new SessionManager();
