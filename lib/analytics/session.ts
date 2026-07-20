/**
 * Session & User Retention Tracking
 * Pure state tracking: maintains session lifecycle and activity metrics
 * No side effects (breadcrumb/event emission handled by manager layer)
 */
import { logger } from '@/lib/utils';

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

    logger.category('analytics').analytics('Session started:', { userId });
  }

  /**
   * End current session and return session metrics
   */
  endSession(): { duration: number; screenViews: number; errorCount: number } | null {
    if (!this.currentSession) return null;

    const now = Date.now();
    const duration = now - this.currentSession.startedAt;
    const metrics = {
      duration,
      screenViews: this.currentSession.screenViews,
      errorCount: this.currentSession.errorCount,
      userId: this.currentSession.userId,
    };

    logger.category('analytics').analytics('Session ended:', {
      durationMinutes: Math.round(duration / 60000),
      screenViews: metrics.screenViews,
      errors: metrics.errorCount,
    });

    this.currentSession = null;
    return metrics;
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

export const sessionManager = new SessionManager();
