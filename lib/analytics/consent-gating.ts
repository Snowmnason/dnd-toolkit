/**
 * @file Consent gating for analytics events.
 *
 * Maps event types to consent categories and provides gate logic to determine
 * if an event should be emitted based on user consent level.
 *
 * This module centralizes consent checking logic at the dispatch layer, so all
 * events (whether from call sites or breadcrumb queue) are consistently gated.
 *
 * **Design**: Event mapping is centralized in event-consent-mapping.ts and can be
 * extended at runtime via registerEventConsentMapping(). Unmapped events default
 * to 'essential' (safe).
 *
 * **Gate Logic**:
 * - 'none' consent: Block all events (user opted out)
 * - 'basic' consent: Allow essential + performance events
 * - 'full' consent: Allow all events (essential + performance + usage)
 *
 * See lib/analytics/README.md for architecture overview.
 */

import { AnalyticsConsent } from '@/lib/analytics/consent';
import {
    ConsentCategory,
    DEFAULT_EVENT_CONSENT_MAPPING,
} from '@/lib/analytics/event-consent-mapping';
import { logger } from '@/lib/utils/logger';

// Re-export for convenience (importers can use either consent-gating or event-consent-mapping)
export { ConsentCategory, DEFAULT_EVENT_CONSENT_MAPPING };

/**
 * Runtime-extended consent mapping.
 * Merged with DEFAULT_EVENT_CONSENT_MAPPING during lookup.
 */
let runtimeMapping = new Map<string, ConsentCategory>();

/**
 * Register additional event-to-consent mappings at runtime.
 *
 * Used by extensions/plugins that add custom analytics events.
 * Provided map is merged with default mapping; runtime mappings override
 * defaults for the same event names.
 *
 * @param mapping Record of event name → consent category
 * @throws Error if any category is invalid
 */
export function registerEventConsentMapping(
  mapping: Record<string, ConsentCategory>
): void {
  // Validate all categories
  const validCategories: ConsentCategory[] = ['essential', 'performance', 'usage'];
  for (const [eventName, category] of Object.entries(mapping)) {
    if (!validCategories.includes(category)) {
      const msg = `Invalid consent category '${category}' for event '${eventName}'`;
      logger.category('analytics').error(msg);
      throw new Error(msg);
    }
    // Add to runtime mapping (Map is safe for dynamic keys)
    runtimeMapping.set(eventName, category);
  }
}

/**
 * Get the consent category required for an event.
 *
 * Looks up event in runtime mapping first, then default mapping.
 * If not found, defaults to 'essential' (fail-safe).
 *
 * @param eventType Optional event type (unused; kept for API consistency)
 * @param eventName Event name to look up
 * @returns Consent category required to emit the event
 */
export function getConsentCategoryForEvent(
  eventType: string | undefined,
  eventName: string
): ConsentCategory {
  // Check runtime mapping first (Map.get is safe), then default mapping
  let category = runtimeMapping.get(eventName) ?? DEFAULT_EVENT_CONSENT_MAPPING.get(eventName);

  if (!category) {
    logger
      .category('analytics')
      .debug(
        `Event '${eventName}' not in consent mapping; defaulting to 'essential'`
      );
    return 'essential';
  }

  return category;
}

/**
 * Evaluate whether an event should be emitted based on consent level.
 *
 * **Gate Logic**:
 * - 'none' consent: Block all events
 * - 'basic' consent: Allow essential + performance events
 * - 'full' consent: Allow all events
 *
 * @param category Consent category of the event
 * @param consentLevel Optional explicit consent level. If not provided, reads from AnalyticsConsent.
 * @returns true if event should emit, false if it should be dropped
 */
export function shouldEmitEvent(
  category: ConsentCategory,
  consentLevel?: ReturnType<typeof AnalyticsConsent.getLevel>
): boolean {
  const level = consentLevel ?? AnalyticsConsent.getLevel();

  // 'none' blocks all
  if (level === 'none') {
    return false;
  }

  // 'basic' allows essential + performance
  if (level === 'basic') {
    return category === 'essential' || category === 'performance';
  }

  // 'full' allows all
  if (level === 'full') {
    return true;
  }

  // Invalid level: block as fail-safe
  logger
    .category('analytics')
    .warn(`Invalid consent level '${level}'; blocking event (fail-safe)`);
  return false;
}
