/**
 * Analytics type definitions
 *
 * Cross-layer contracts for the analytics domain.
 * Consumed by managers, lib, hooks, and system layers without circular imports.
 */

/**
 * User consent level for analytics tracking.
 *
 * - 'none'  — analytics disabled entirely
 * - 'basic' — essential events only (errors, auth, session); GDPR-safe default
 * - 'full'  — all events including usage and performance; requires explicit opt-in
 *
 * Reading: import { currentConsentLevel } directly for fast synchronous checks.
 * Writing: must go through AnalyticsConsent.setLevel() or AnalyticsConsent.initialize()
 * to ensure persistence and downstream side-effects (buffer purge, DB sync).
 */
export type ConsentLevel = 'none' | 'basic' | 'full';

/**
 * Global consent level — fast synchronous read for hot-path consent checks.
 *
 * Set during app bootstrap by AnalyticsConsent.initialize() and kept in sync
 * by AnalyticsConsent.setLevel(). Any reads outside bootstrap/initialization
 * that bypass the pipeline will get the last-known value ('basic' until set).
 *
 * Do NOT write to this directly. Route all writes through AnalyticsConsent.
 */
export let currentConsentLevel: ConsentLevel = 'basic';

/**
 * Internal setter — called only by AnalyticsConsent.initialize() and setLevel().
 * Not exported from the analytics manager; use AnalyticsConsent to change consent.
 */
export function setCurrentConsentLevel(level: ConsentLevel): void {
  currentConsentLevel = level;
}
