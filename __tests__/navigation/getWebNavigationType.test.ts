import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module-level mocks for all hook dependencies ──────────────────────────────
// getWebNavigationType is a pure utility exported from use-bootstrap-route-guard.
// The hook itself depends on these imports; mock them so the module loads in node.

vi.mock('expo-router', () => ({ useSegments: vi.fn(() => []) }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useEffect: vi.fn(), useRef: vi.fn(() => ({ current: false })) };
});
vi.mock('@/lib/auth/auth-state', () => ({
  AuthStateManager: { getBootstrapFreshness: vi.fn(() => 'none') },
}));
vi.mock('@/lib/navigation', () => ({
  executeInternalRedirectNavigation: vi.fn(),
}));
vi.mock('@/lib/utils', () => ({
  logger: {
    category: () => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    }),
  },
}));

import { getWebNavigationType } from '@/hooks/navigation/use-bootstrap-route-guard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockModernApi(type: string) {
  (globalThis as any).performance = {
    getEntriesByType: vi.fn().mockReturnValue([{ type } as PerformanceNavigationTiming]),
  };
}

function mockLegacyApi(type: number) {
  (globalThis as any).performance = {
    getEntriesByType: vi.fn().mockReturnValue([]),
    navigation: { type },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getWebNavigationType()', () => {
  let savedPerformance: typeof globalThis.performance;

  beforeEach(() => {
    savedPerformance = (globalThis as any).performance;
  });

  afterEach(() => {
    (globalThis as any).performance = savedPerformance;
  });

  describe('modern PerformanceNavigationTiming API', () => {
    it('returns navigate when entry type is navigate', () => {
      mockModernApi('navigate');
      expect(getWebNavigationType()).toBe('navigate');
    });

    it('returns reload when entry type is reload', () => {
      mockModernApi('reload');
      expect(getWebNavigationType()).toBe('reload');
    });

    it('returns back_forward when entry type is back_forward', () => {
      mockModernApi('back_forward');
      expect(getWebNavigationType()).toBe('back_forward');
    });

    it('falls through to legacy fallback when entry type is unrecognized', () => {
      (globalThis as any).performance = {
        getEntriesByType: vi.fn().mockReturnValue([{ type: 'prerender' }]),
        navigation: { type: 1 }, // reload via legacy
      };
      expect(getWebNavigationType()).toBe('reload');
    });
  });

  describe('legacy performance.navigation fallback', () => {
    it('returns navigate for legacy type 0', () => {
      mockLegacyApi(0);
      expect(getWebNavigationType()).toBe('navigate');
    });

    it('returns reload for legacy type 1', () => {
      mockLegacyApi(1);
      expect(getWebNavigationType()).toBe('reload');
    });

    it('returns back_forward for legacy type 2', () => {
      mockLegacyApi(2);
      expect(getWebNavigationType()).toBe('back_forward');
    });
  });

  describe('unavailable / edge cases', () => {
    it('returns unknown when performance is undefined', () => {
      (globalThis as any).performance = undefined;
      expect(getWebNavigationType()).toBe('unknown');
    });

    it('returns unknown when neither API provides a recognized value', () => {
      (globalThis as any).performance = {
        getEntriesByType: vi.fn().mockReturnValue([]),
        navigation: { type: 99 },
      };
      expect(getWebNavigationType()).toBe('unknown');
    });

    it('returns unknown when getEntriesByType returns empty and navigation is absent', () => {
      (globalThis as any).performance = {
        getEntriesByType: vi.fn().mockReturnValue([]),
      };
      expect(getWebNavigationType()).toBe('unknown');
    });
  });
});
