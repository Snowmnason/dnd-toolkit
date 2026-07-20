/**
 * @file Centralized consent gating for analytics events and breadcrumbs.
 *
 * This module provides the core gate logic for filtering events and breadcrumbs
 * based on user consent level. All analytics dispatch and breadcrumb queueing
 * must flow through these functions to ensure consistent, privacy-first filtering.
 *
 * **Design Principle:** Consent checks happen at the dispatch layer (dispatchEvent, breadcrumbQueue.enqueue),
 * not at call sites. This creates a single choke point for enforcement.
 *
 * **Gate Logic** (3-tier):
 * - **'essential'**: Always emit (even for 'none', but marked as optional send)
 * - **'performance'**: Emit if consentLevel >= 'basic'
 * - **'usage'**: Emit only if consentLevel === 'full'
 * - **null/unmapped**: Default to 'performance' (requires >= 'basic' consent).
 *   This prevents forgotten events from leaking to 'none' consent users.
 *   A debug message is logged for unmapped events to prompt developer to add explicit mapping.
 */

import type { ConsentLevel } from '@/type-definitions/analytics-types';
import { logger } from '@/lib/utils/logger';
import {
  ConsentCategory,
  DEFAULT_EVENT_CONSENT_MAPPING,
} from '@/maps/event-consent-mapping';

// Type and map exports
export type { ConsentLevel };
export { ConsentCategory, DEFAULT_EVENT_CONSENT_MAPPING };

// Unused: Plugin analytics support (planned for plugin architecture phase)
// When implemented, will allow extensions/plugins to register custom event consent mappings.
// let runtimeMapping = new Map<string, ConsentCategory>();
// export function registerEventConsentMapping(...) — see git history

/**
 * Get the consent category required for an event.
 *
 * Looks up event name in default mapping.
 * Returns null if not found; caller should apply default ('performance' — requires >= 'basic' consent).
 *
 * @param eventName - Event name to look up
 * @returns Consent category or null if unmapped
 *
 * @example
 * const category = getConsentCategoryForEvent('screen_view');
 * // Returns 'usage'
 *
 * const unknown = getConsentCategoryForEvent('custom_event');
 * // Returns null
 */
export function getConsentCategoryForEvent(
  eventName: string
): ConsentCategory | null {
  const category = DEFAULT_EVENT_CONSENT_MAPPING.get(eventName);

  if (!category) {
    logger
      .category('analytics')
      .debug(`Event '${eventName}' not in consent mapping; will default to 'performance' (requires >= 'basic' consent). Add to event-consent-mapping.ts if needed.`);
    return null;
  }

  return category;
}

/**
 * Determine if an event should be emitted based on its consent category and user's consent level.
 *
 * **Gate Logic** (3-tier):
 * - **'essential'**: Always emit (true), even for 'none' consent (but marked as optional send)
 * - **'performance'**: Emit if consentLevel >= 'basic'
 * - **'usage'**: Emit only if consentLevel === 'full'
 * - **null/unmapped**: Default to 'performance' (requires >= 'basic' consent, never leaks to 'none')
 *
 * @param category - Consent category from mapping, or null if unmapped
 * @param consentLevel - User's current consent level
 * @returns true if event should emit; false if it should be dropped
 *
 * @example
 * // Usage event with basic consent → false (drop)
 * shouldEmitEvent('usage', 'basic') // false
 *
 * // Performance event with basic consent → true (pass)
 * shouldEmitEvent('performance', 'basic') // true
 *
 * // Essential event with none consent → true (pass, but optional send)
 * shouldEmitEvent('essential', 'none') // true
 *
 * // Unmapped event with basic consent → true (default to 'performance', basic >= basic)
 * shouldEmitEvent(null, 'basic') // true
 *
 * // Unmapped event with none consent → false (default to 'performance', none < basic)
 * shouldEmitEvent(null, 'none') // false
 */
export function shouldEmitEvent(
  category: ConsentCategory | null,
  consentLevel: ConsentLevel
): boolean {
  // Unmapped events default to 'performance' (requires >= 'basic' consent).
  // This ensures forgotten/new events cannot leak to 'none' consent users.
  // A debug message is logged by getConsentCategoryForEvent() for unmapped names.
  const effectiveCategory = category || 'performance';

  switch (effectiveCategory) {
    case 'essential':
      // Essential events always emit, even for 'none' (but will be optional send)
      return true;

    case 'performance':
      // Requires at least 'basic' consent
      return consentLevel === 'basic' || consentLevel === 'full';

    case 'usage':
      // Requires 'full' consent
      return consentLevel === 'full';

    default:
      // Fallback to essential for any unexpected category
      return true;
  }
}
