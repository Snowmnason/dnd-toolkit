/**
 * Session & User Retention Tracking
 * Tracks user sessions, duration, and engagement metrics
 */

import { logger } from '../utils/logger';
import { Analytics } from './index';

interface SessionData {
  startedAt: number;
  userId?: string;
  screenViews: number;
  errorCount: number;
  lastActivityAt: number;
}

class SessionManager {
  private currentSession: SessionData | null = null;
  private sessionStorageKey = 'dnd_analytics_session';

  /**
   * Start a new session
   */
  startSession(userId?: string): void {
    const now = Date.now();
    this.currentSession = {
      startedAt: now,
      userId,
      screenViews: 0,
      errorCount: 0,
      lastActivityAt: now,
    };

    Analytics.track('session_started', {
      userId: userId || undefined,
      timestamp: now,
    });

    logger.debug('analytics', 'Session started:', { userId });
  }

  /**
   * End current session and track metrics
   */
  endSession(): void {
    if (!this.currentSession) return;

    const now = Date.now();
    const duration = now - this.currentSession.startedAt;
    const durationMinutes = Math.round(duration / 60000);

    Analytics.track('session_ended', {
      duration_ms: duration,
      duration_minutes: durationMinutes,
      screen_views: this.currentSession.screenViews,
      errors: this.currentSession.errorCount,
      userId: this.currentSession.userId || undefined,
    });

    logger.debug('analytics', 'Session ended:', {
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
}

export const SessionManager_ = new SessionManager();
