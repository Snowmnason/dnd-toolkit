/**
 * Analytics Consent/Privacy Layer
 * 
 * Provides a foundation for consent-based analytics tracking.
 * Allows users to opt-in/out of analytics collection at runtime.
 * Future-proofs for GDPR, privacy regulations, and user preferences.
 * 
 * Default: 'basic' consent level (essential tracking only)
 * This ensures GDPR compliance out-of-the-box. Users must explicitly
 * opt-in to 'full' tracking for usage analytics and performance monitoring.
 */

export type ConsentLevel = 'none' | 'basic' | 'full';

class AnalyticsConsentManager {
  private consentLevel: ConsentLevel = 'basic'; // Default to basic for GDPR compliance

  /**
   * Set the consent level
   * - 'none': No analytics tracking
   * - 'basic': Only essential events (errors, auth)
   * - 'full': All analytics events including usage/performance
   */
  setLevel(level: ConsentLevel): void {
    this.consentLevel = level;
  }

  /**
   * Get current consent level
   */
  getLevel(): ConsentLevel {
    return this.consentLevel;
  }

  /**
   * Check if tracking is allowed for a given consent category
   */
  isAllowed(category: 'essential' | 'performance' | 'usage'): boolean {
    if (this.consentLevel === 'none') return false;
    if (this.consentLevel === 'basic') return category === 'essential';
    return true; // 'full' allows everything
  }
}

export const AnalyticsConsent = new AnalyticsConsentManager();
