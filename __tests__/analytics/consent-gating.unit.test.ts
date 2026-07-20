import { describe, expect, it } from 'vitest';

import {
    DEFAULT_EVENT_CONSENT_MAPPING,
    getConsentCategoryForEvent,
    shouldEmitEvent,
} from '@/lib/analytics/consent/consent-gating';
import type { ConsentLevel } from '@/type-definitions/analytics-types';

describe('Consent Gating — unit', () => {
  it('resolves every mapping key via getConsentCategoryForEvent()', () => {
    for (const [eventName, category] of DEFAULT_EVENT_CONSENT_MAPPING.entries()) {
      expect(getConsentCategoryForEvent(eventName)).toBe(category);
    }
  });

  it('uses representative events and enforces gating decisions per consent level', () => {
    const none: ConsentLevel = 'none';
    const basic: ConsentLevel = 'basic';
    const full: ConsentLevel = 'full';

    // Pick one representative event name for each category from the actual mapping.
    const representatives: Record<string, string> = {};
    for (const [eventName, category] of DEFAULT_EVENT_CONSENT_MAPPING.entries()) {
      if (!representatives[category]) representatives[category] = eventName;
      if (representatives.essential && representatives.performance && representatives.usage) break;
    }

    // Sanity: mapping should provide one representative per category for the test.
    expect(representatives.essential).toBeDefined();
    expect(representatives.performance).toBeDefined();
    expect(representatives.usage).toBeDefined();

    // Essential events: always emitted regardless of consent.
    const essentialCat = getConsentCategoryForEvent(representatives.essential);
    expect(essentialCat).toBe('essential');
    expect(shouldEmitEvent(essentialCat, none)).toBe(true);
    expect(shouldEmitEvent(essentialCat, basic)).toBe(true);
    expect(shouldEmitEvent(essentialCat, full)).toBe(true);

    // Performance events: emitted for basic+ and full, blocked for none.
    const perfCat = getConsentCategoryForEvent(representatives.performance);
    expect(perfCat).toBe('performance');
    expect(shouldEmitEvent(perfCat, none)).toBe(false);
    expect(shouldEmitEvent(perfCat, basic)).toBe(true);
    expect(shouldEmitEvent(perfCat, full)).toBe(true);

    // Usage events: only emitted when consent is full.
    const usageCat = getConsentCategoryForEvent(representatives.usage);
    expect(usageCat).toBe('usage');
    expect(shouldEmitEvent(usageCat, none)).toBe(false);
    expect(shouldEmitEvent(usageCat, basic)).toBe(false);
    expect(shouldEmitEvent(usageCat, full)).toBe(true);
  });

  it('treats unmapped events as performance (strict default — never leaks to none)', () => {
    const unknownEvent = '__this_event_is_not_mapped__';
    const cat = getConsentCategoryForEvent(unknownEvent);
    expect(cat).toBeNull();

    // shouldEmitEvent should treat null/unmapped as 'performance' semantics:
    // - 'none'  → false (blocked — doesn't leak to users who opted out)
    // - 'basic' → true  (allowed — user accepted basic tracking)
    // - 'full'  → true  (allowed)
    expect(shouldEmitEvent(cat, 'none')).toBe(false);
    expect(shouldEmitEvent(cat, 'basic')).toBe(true);
    expect(shouldEmitEvent(cat, 'full')).toBe(true);
  });

  it('verifies regression_detected mapping and gating matches its category', () => {
    const regressionCategory = getConsentCategoryForEvent('regression_detected');
    // The mapping determines how regression events are handled. The test asserts
    // the mapping is one of the allowed categories and that gating follows that
    // category's semantics.
    expect(['essential', 'performance', 'usage']).toContain(regressionCategory);

    if (regressionCategory === 'performance') {
      expect(shouldEmitEvent(regressionCategory, 'none')).toBe(false);
      expect(shouldEmitEvent(regressionCategory, 'basic')).toBe(true);
    } else if (regressionCategory === 'usage') {
      expect(shouldEmitEvent(regressionCategory, 'basic')).toBe(false);
      expect(shouldEmitEvent(regressionCategory, 'full')).toBe(true);
    } else {
      // 'essential' semantics: always allowed
      expect(shouldEmitEvent(regressionCategory, 'none')).toBe(true);
      expect(shouldEmitEvent(regressionCategory, 'basic')).toBe(true);
    }
  });
});
