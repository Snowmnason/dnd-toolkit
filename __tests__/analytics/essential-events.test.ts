import { getConsentCategoryForEvent, shouldEmitEvent } from '@/lib/analytics/consent/consent-gating';
import { describe, expect, it } from 'vitest';

describe('Essential event mappings', () => {
  it('safe_mode events and bootstrap are essential and allowed for none', () => {
    const names = [
      'safe_mode_entered',
      'safe_mode_action',
      'safe_mode_recovery_action_selected',
      'safe_mode_recovery_action_succeeded',
      'safe_mode_recovery_action_failed',
      'app_bootstrap_complete',
    ];

    for (const n of names) {
      const cat = getConsentCategoryForEvent(undefined, n);
      expect(cat).toBe('essential');
      expect(shouldEmitEvent(cat, 'none')).toBe(true);
    }
  });
});
