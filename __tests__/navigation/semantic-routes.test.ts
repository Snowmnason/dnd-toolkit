import { describe, expect, it, vi } from 'vitest';

import { isSemanticRoute, resolveSemanticRoute } from '@/lib/navigation/semantic-routes';

// Mocks must be declared before the module under test is imported.
// Vitest hoists vi.mock() calls to run before all imports.

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

vi.mock('@/lib/navigation/navigationConfig', () => ({
  ROUTE_CONFIGS: [
    { path: '/login/sign-in', semanticId: 'sign-in' },
    { path: '/login/sign-up', semanticId: 'sign-up' },
    { path: '/', semanticId: 'welcome' },
    { path: '/select/world-selection', semanticId: 'world-selection' },
    { path: '/settings', semanticId: 'settings' },
    {
      path: '/settings/stylemobile',
      semanticId: 'style-playground',
      platformPaths: {
        mobile: '/settings/stylemobile',
        desktop: '/settings/styledesktop',
      },
    },
    {
      path: '/main/main-landing',
      semanticId: 'home',
      platformPaths: {
        mobile: '/main/world',
        desktop: '/main/main-landing',
      },
    },
  ],
}));

// ─── isSemanticRoute ─────────────────────────────────────────────────────────

describe('isSemanticRoute()', () => {
  it('returns true for all known semantic IDs', () => {
    expect(isSemanticRoute('sign-in')).toBe(true);
    expect(isSemanticRoute('sign-up')).toBe(true);
    expect(isSemanticRoute('forgot-password')).toBe(true);
    expect(isSemanticRoute('world-selection')).toBe(true);
    expect(isSemanticRoute('home')).toBe(true);
    expect(isSemanticRoute('style-playground')).toBe(true);
    expect(isSemanticRoute('settings')).toBe(true);
    expect(isSemanticRoute('welcome')).toBe(true);
    expect(isSemanticRoute('default')).toBe(true);
  });

  it('returns false for concrete paths', () => {
    expect(isSemanticRoute('/login/sign-in')).toBe(false);
    expect(isSemanticRoute('/main/main-landing')).toBe(false);
    expect(isSemanticRoute('/select/world-selection')).toBe(false);
    expect(isSemanticRoute('/')).toBe(false);
  });

  /**
   * Documents the invariant that drove the canonicalize-before-check bug:
   * canonicalizePath('sign-in') → '/sign-in', which must NOT pass isSemanticRoute.
   * navManager must check isSemanticRoute on the raw input BEFORE canonicalizePath.
   */
  it('returns false for canonicalized (leading-slash) forms of semantic IDs', () => {
    expect(isSemanticRoute('/sign-in')).toBe(false);
    expect(isSemanticRoute('/home')).toBe(false);
    expect(isSemanticRoute('/style-playground')).toBe(false);
    expect(isSemanticRoute('/world-selection')).toBe(false);
  });

  it('returns false for empty string and unknown strings', () => {
    expect(isSemanticRoute('')).toBe(false);
    expect(isSemanticRoute('unknown-route')).toBe(false);
    expect(isSemanticRoute('main-landing')).toBe(false);
  });
});

// ─── resolveSemanticRoute ─────────────────────────────────────────────────────

describe('resolveSemanticRoute()', () => {
  describe('platform-conditional routes (platformPaths)', () => {
    it('resolves style-playground to mobile path on mobile', async () => {
      await expect(resolveSemanticRoute('style-playground', 'mobile')).resolves.toBe(
        '/settings/stylemobile',
      );
    });

    it('resolves style-playground to desktop path on desktop', async () => {
      await expect(resolveSemanticRoute('style-playground', 'desktop')).resolves.toBe(
        '/settings/styledesktop',
      );
    });

    it('resolves style-playground to config.path when no platform is given', async () => {
      await expect(resolveSemanticRoute('style-playground')).resolves.toBe(
        '/settings/stylemobile',
      );
    });

    it('resolves home to mobile path on mobile', async () => {
      await expect(resolveSemanticRoute('home', 'mobile')).resolves.toBe('/main/world');
    });

    it('resolves home to desktop path on desktop', async () => {
      await expect(resolveSemanticRoute('home', 'desktop')).resolves.toBe('/main/main-landing');
    });

    it('resolves home to config.path when no platform is given', async () => {
      await expect(resolveSemanticRoute('home')).resolves.toBe('/main/main-landing');
    });
  });

  describe('simple routes without platformPaths', () => {
    it('resolves sign-in to its concrete path regardless of platform param', async () => {
      await expect(resolveSemanticRoute('sign-in')).resolves.toBe('/login/sign-in');
      await expect(resolveSemanticRoute('sign-in', 'mobile')).resolves.toBe('/login/sign-in');
      await expect(resolveSemanticRoute('sign-in', 'desktop')).resolves.toBe('/login/sign-in');
    });

    it('resolves world-selection to its concrete path', async () => {
      await expect(resolveSemanticRoute('world-selection')).resolves.toBe(
        '/select/world-selection',
      );
    });

    it('resolves welcome to root path', async () => {
      await expect(resolveSemanticRoute('welcome')).resolves.toBe('/');
    });
  });

  describe('error handling', () => {
    it('throws when no route config has a matching semanticId', async () => {
      // 'forgot-password' is a valid SemanticRoute type but absent from the mock ROUTE_CONFIGS
      await expect(resolveSemanticRoute('forgot-password')).rejects.toThrow(
        /No route config found for semantic route: 'forgot-password'/,
      );
    });
  });
});
