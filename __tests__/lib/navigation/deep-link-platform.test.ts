/**
 * Tests: Platform gate in evaluateObservedRouteChange()
 *
 * Verifies that deep links (and any OS-originated route changes) are blocked when the
 * destination route is restricted to the opposite platform. This mirrors the protection
 * that executeRouteNavigation() already provides for app-initiated navigations.
 *
 * Mobile-only routes: /main/world, /main/characters, /settings/stylemobile
 * Desktop-only routes: /main/main-landing, /settings/styledesktop
 * Unconstrained routes: /login/sign-in, /select/world-selection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Platform } from 'react-native';

import { evaluateObservedRouteChange } from '@/lib/navigation/navManager';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any dynamic imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  logger: {
    category: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
  },
}));

vi.mock('@/config/core/loader', () => ({
  getAppConfig: vi.fn(() => ({
    navigationPolicy: { defaultAccessMode: 'protected_by_default' },
  })),
}));

vi.mock('@/config/routing-auth-config', () => ({
  AUTH_CONFIG: {
    protectedRoutes: ['select', 'main', 'settings'],
    publicRoutes: ['login', 'web'],
    redirectOnUnauthenticated: '/login/sign-in',
  },
}));

vi.mock('@/lib/auth/auth-state', () => ({
  AuthStateManager: {
    getUserId: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => false),
    getWorldAccess: vi.fn(async () => null),
  },
}));

vi.mock('@/lib/storage', () => ({
  StorageManager: { getRaw: vi.fn(async () => null), get: vi.fn(async () => null) },
  FastCache: { getItem: vi.fn(), setItem: vi.fn() },
  SecureStorage: { getItem: vi.fn(), setItem: vi.fn() },
}));

vi.mock('@/maps', () => ({
  STORAGE_KEYS: {
    CONNECTED_WORLDS: 'connected_worlds',
    LAST_SELECTED_WORLD: 'last_selected_world',
  },
}));

vi.mock('@/maps/storage-keys', () => ({
  STORAGE_KEYS: {
    CONNECTED_WORLDS: 'connected_worlds',
    LAST_SELECTED_WORLD: 'last_selected_world',
  },
}));

vi.mock('@/type-definitions/', () => ({}));

// Nav service — prevent real transport calls (transport is not initialized in tests).
vi.mock('@/middleware/navigation', () => ({
  callStateQueriesNav: vi.fn(() => undefined),
  callRouteTransitionNav: vi.fn(async () => ({ status: 'executed' })),
  callHistoryTransitionNav: vi.fn(async () => ({ status: 'executed' })),
  callUtilityTransitionNav: vi.fn(async () => ({ status: 'executed' })),
  callExternalTransitionNav: vi.fn(async () => ({ status: 'executed' })),
}));

// Param resolvers — prevent auth-state / database reads for non-platform-blocked paths.
vi.mock('@/lib/navigation/param-resolvers', () => ({
  PARAM_RESOLVERS: {},
  resolveContextParams: vi.fn(async () => ({ userId: undefined, worldId: undefined })),
}));

// Trusted-URL helpers — prevent storage reads on import
vi.mock('@/middleware/storage', () => ({
  persistValue: vi.fn(async () => {}),
  retrieveValue: vi.fn(async () => null),
  persistRawValue: vi.fn(async () => {}),
  retrieveRawValue: vi.fn(async () => null),
  removeValue: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cast Platform to a mutable object so tests can override OS per case. */
const mutablePlatform = Platform as { OS: string };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateObservedRouteChange() — platform gate', () => {
  // Snapshot the original OS so we can restore after each test.
  let originalOS: string;

  beforeEach(() => {
    originalOS = mutablePlatform.OS;
  });

  afterEach(() => {
    mutablePlatform.OS = originalOS;
  });

  // ── Desktop context (Platform.OS = 'web') ─────────────────────────────────

  describe('desktop context (Platform.OS = "web")', () => {
    beforeEach(() => {
      mutablePlatform.OS = 'web';
    });

    it('blocks a deep link to the mobile-only landing route (/main/world)', async () => {
      const result = await evaluateObservedRouteChange('/main/world', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('blocks a deep link to a mobile-only panel route (/main/characters)', async () => {
      const result = await evaluateObservedRouteChange('/main/characters', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('blocks a deep link to the mobile-only style playground (/settings/stylemobile)', async () => {
      const result = await evaluateObservedRouteChange('/settings/stylemobile', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('allows a desktop-only route (/main/main-landing) — not platform-incompatible', async () => {
      const result = await evaluateObservedRouteChange('/main/main-landing', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });

    it('allows a desktop-only style playground (/settings/styledesktop) — not platform-incompatible', async () => {
      const result = await evaluateObservedRouteChange('/settings/styledesktop', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });
  });

  // ── Mobile context (Platform.OS = 'ios') ─────────────────────────────────

  describe('mobile context (Platform.OS = "ios")', () => {
    beforeEach(() => {
      mutablePlatform.OS = 'ios';
    });

    it('blocks a deep link to the desktop-only landing route (/main/main-landing)', async () => {
      const result = await evaluateObservedRouteChange('/main/main-landing', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('blocks a deep link to the desktop-only style playground (/settings/styledesktop)', async () => {
      const result = await evaluateObservedRouteChange('/settings/styledesktop', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('allows a mobile-only route (/main/world) — not platform-incompatible', async () => {
      const result = await evaluateObservedRouteChange('/main/world', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });

    it('allows a mobile-only panel route (/main/characters) — not platform-incompatible', async () => {
      const result = await evaluateObservedRouteChange('/main/characters', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });
  });

  // ── Android (same as iOS — mobile platform) ───────────────────────────────

  describe('mobile context (Platform.OS = "android")', () => {
    beforeEach(() => {
      mutablePlatform.OS = 'android';
    });

    it('blocks a deep link to the desktop-only landing route (/main/main-landing)', async () => {
      const result = await evaluateObservedRouteChange('/main/main-landing', '/', 'deep-link');
      expect(result.status).toBe('aborted');
      expect(result.reason).toBe('platform-incompatible');
    });

    it('allows a mobile-only route (/main/world)', async () => {
      const result = await evaluateObservedRouteChange('/main/world', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });
  });

  // ── Unconstrained routes (no platform field) ─────────────────────────────

  describe('unconstrained routes (no platform constraint)', () => {
    it('allows /login/sign-in on desktop', async () => {
      mutablePlatform.OS = 'web';
      const result = await evaluateObservedRouteChange('/login/sign-in', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });

    it('allows /login/sign-in on mobile', async () => {
      mutablePlatform.OS = 'ios';
      const result = await evaluateObservedRouteChange('/login/sign-in', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });

    it('allows /select/world-selection on desktop', async () => {
      mutablePlatform.OS = 'web';
      const result = await evaluateObservedRouteChange('/select/world-selection', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });

    it('allows /select/world-selection on mobile', async () => {
      mutablePlatform.OS = 'ios';
      const result = await evaluateObservedRouteChange('/select/world-selection', '/', 'deep-link');
      expect(result.reason).not.toBe('platform-incompatible');
    });
  });
});
