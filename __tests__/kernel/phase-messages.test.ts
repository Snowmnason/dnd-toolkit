import { PHASE_MESSAGES, getPhaseMessage, type PhaseName } from '@/localization/phase-messages';
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Phase messages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defines non-empty message arrays for every phase', () => {
    for (const key of Object.keys(PHASE_MESSAGES) as Array<PhaseName>) {
      expect(Array.isArray(PHASE_MESSAGES[key])).toBe(true);
      expect(PHASE_MESSAGES[key].length).toBeGreaterThan(0);
    }
  });

  it('getPhaseMessage returns a deterministic entry when Math.random is stubbed', () => {
    for (const key of Object.keys(PHASE_MESSAGES) as Array<PhaseName>) {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const msg = getPhaseMessage(key);
      expect(msg).toBe(PHASE_MESSAGES[key][0]);
      spy.mockRestore();
    }
  });
});
