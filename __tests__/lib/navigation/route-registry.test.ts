import { describe, expect, it } from 'vitest';

import {
    type RouteConfig,
    validateRouteRegistry,
} from '@/lib/navigation/navigationConfig';

// ─── validateRouteRegistry — violation detection ─────────────────────────────

describe('validateRouteRegistry()', () => {
  describe('duplicate path + platform detection', () => {
    it('returns no violations for a clean registry', () => {
      const configs: RouteConfig[] = [
        { path: '/main/main-landing', platform: 'desktop', title: 'Home' },
        { path: '/main/world', platform: 'mobile', title: 'Home' },
        { path: '/select/world-selection', title: 'Select' },
      ];
      expect(validateRouteRegistry(configs)).toHaveLength(0);
    });

    it('detects two concrete entries with the same path and same platform', () => {
      const configs: RouteConfig[] = [
        { path: '/main/world', platform: 'mobile', title: 'A', analyticsName: 'a' },
        { path: '/main/world', platform: 'mobile', title: 'B', analyticsName: 'b' },
      ];
      const violations = validateRouteRegistry(configs);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('duplicate-path-platform');
      expect(violations[0].message).toMatch("path='/main/world'");
      expect(violations[0].message).toMatch("platform='mobile'");
    });

    it('detects two unconstrained concrete entries with the same path', () => {
      const configs: RouteConfig[] = [
        { path: '/select/world-selection', title: 'A' },
        { path: '/select/world-selection', title: 'B' },
      ];
      const violations = validateRouteRegistry(configs);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('duplicate-path-platform');
    });

    it('does not flag same path on different platforms', () => {
      // desktop landing vs mobile landing share no conflict
      const configs: RouteConfig[] = [
        { path: '/main/main-landing', platform: 'desktop', title: 'Desktop Home' },
        { path: '/main/main-landing', platform: 'mobile', title: 'Mobile Home' },
      ];
      expect(validateRouteRegistry(configs)).toHaveLength(0);
    });

    it('does not flag a semantic anchor that shares a path with a concrete entry', () => {
      const configs: RouteConfig[] = [
        {
          path: '/main/main-landing',
          semanticAnchor: true,
          semanticId: 'home',
          platformPaths: { mobile: '/main/world', desktop: '/main/main-landing' },
          title: 'Home',
        },
        { path: '/main/main-landing', platform: 'desktop', title: 'Home Desktop' },
      ];
      expect(validateRouteRegistry(configs)).toHaveLength(0);
    });
  });

  describe('duplicate semanticId detection', () => {
    it('detects two entries with the same semanticId', () => {
      const configs: RouteConfig[] = [
        { path: '/login/sign-in', semanticId: 'sign-in', title: 'Sign In' },
        { path: '/auth/sign-in', semanticId: 'sign-in', title: 'Sign In (alt)' },
      ];
      const violations = validateRouteRegistry(configs);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('duplicate-semantic-id');
      expect(violations[0].message).toMatch("'sign-in'");
    });

    it('does not flag entries without a semanticId', () => {
      const configs: RouteConfig[] = [
        { path: '/main/characters-npcs', title: 'Characters' },
        { path: '/main/items-treasure', title: 'Items' },
      ];
      expect(validateRouteRegistry(configs)).toHaveLength(0);
    });
  });

  describe('multiple violations', () => {
    it('accumulates all violations (duplicate path/platform + duplicate semanticId)', () => {
      const configs: RouteConfig[] = [
        { path: '/main/world', platform: 'mobile', title: 'A', semanticId: 'home' },
        { path: '/main/world', platform: 'mobile', title: 'B', semanticId: 'home' }, // both violations
      ];
      const violations = validateRouteRegistry(configs);
      const types = violations.map((v) => v.type);
      expect(types).toContain('duplicate-path-platform');
      expect(types).toContain('duplicate-semantic-id');
    });
  });
});

// ─── validateRouteRegistry — real registry must be clean ─────────────────────

describe('Real ROUTE_CONFIGS registry integrity', () => {
  it('has no duplicate concrete path + platform combinations', async () => {
    // Import the real registry at test-run time.
    // We import navigationConfig directly (not via barrel) so vi.mock calls in other
    // test files don't interfere — each test file gets its own module scope.
    const { ROUTE_CONFIGS, validateRouteRegistry: validate } = await import(
      '@/lib/navigation/navigationConfig'
    );
    const duplicates = validate(ROUTE_CONFIGS).filter(
      (v) => v.type === 'duplicate-path-platform',
    );
    expect(duplicates).toHaveLength(0);
  });

  it('has no duplicate semanticId values', async () => {
    const { ROUTE_CONFIGS, validateRouteRegistry: validate } = await import(
      '@/lib/navigation/navigationConfig'
    );
    const duplicates = validate(ROUTE_CONFIGS).filter(
      (v) => v.type === 'duplicate-semantic-id',
    );
    expect(duplicates).toHaveLength(0);
  });
});

// ─── getRouteConfig — semantic anchor bypass ─────────────────────────────────

describe('getRouteConfig() — semantic anchor bypass + platform preference', () => {
  it('returns the concrete desktop entry for /main/main-landing on desktop', async () => {
    const { getRouteConfig } = await import('@/lib/navigation/navigationConfig');
    const config = getRouteConfig({
      segments: ['main', 'main-landing'],
      params: {},
      isMobile: false,
    });
    // Must NOT return the semantic anchor (analyticsName: 'main_home')
    // Must return the concrete desktop entry (analyticsName: 'main_landing')
    expect(config.analyticsName).toBe('main_landing');
    expect(config.semanticAnchor).toBeUndefined();
  });

  it('returns the concrete mobile entry for /main/world on mobile', async () => {
    const { getRouteConfig } = await import('@/lib/navigation/navigationConfig');
    const config = getRouteConfig({
      segments: ['main', 'world'],
      params: {},
      isMobile: true,
    });
    expect(config.analyticsName).toBe('main_world_landing');
    expect(config.semanticAnchor).toBeUndefined();
  });

  it('returns the concrete mobile entry for /settings/stylemobile on mobile', async () => {
    const { getRouteConfig } = await import('@/lib/navigation/navigationConfig');
    const config = getRouteConfig({
      segments: ['settings', 'stylemobile'],
      params: {},
      isMobile: true,
    });
    // Must NOT return the semantic anchor (analyticsName: 'settings_style_playground')
    // Must return the concrete mobile entry (analyticsName: 'settings_style_mobile')
    expect(config.analyticsName).toBe('settings_style_mobile');
    expect(config.semanticAnchor).toBeUndefined();
  });

  it('returns an unconstrained entry when no platform-specific match exists', async () => {
    const { getRouteConfig } = await import('@/lib/navigation/navigationConfig');
    const config = getRouteConfig({
      segments: ['select', 'world-selection'],
      params: {},
      isMobile: false,
    });
    expect(config.analyticsName).toBe('select_world');
    expect(config.platform).toBeUndefined();
  });
});
