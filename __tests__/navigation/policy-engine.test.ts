import { describe, expect, it, vi } from 'vitest';

import { PolicyEngine } from '@/lib/navigation/policyEngine';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/utils', () => ({
  logger: {
    category: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
  },
}));

vi.mock('@/lib/navigation/routeCanonicalizer', async (importOriginal) => {
  // Use the real implementation — we want canonical matching to be exercised.
  return await importOriginal();
});

vi.mock('@/config/core/loader', () => ({
  getAppConfig: () => ({
    navigationPolicy: { defaultAccessMode: 'protected_by_default' },
  }),
}));

vi.mock('@/config/routing-auth-config', () => ({
  AUTH_CONFIG: {
    protectedRoutes: ['select', 'main', 'settings'] as const,
    publicRoutes: ['login', 'web'] as const,
    redirectOnUnauthenticated: '/login/sign-in' as const,
  },
}));

vi.mock('@/lib/auth/auth-state', () => ({
  AuthStateManager: { getUserData: async () => null },
}));

vi.mock('@/lib/storage', () => ({
  StorageManager: { get: async () => null },
}));

vi.mock('@/maps', () => ({
  STORAGE_KEYS: { CONNECTED_WORLDS: 'connected_worlds' },
}));

vi.mock('@/type-definitions/', () => ({}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PolicyVerdict = ReturnType<typeof PolicyEngine.getPolicyForRoute>;

function classify(route: string, mode: 'protected_by_default' | 'public_by_default' = 'protected_by_default'): PolicyVerdict {
  return PolicyEngine.getPolicyForRoute(route, mode);
}

// ─── protected_by_default mode ────────────────────────────────────────────────

describe('PolicyEngine.getPolicyForRoute — protected_by_default', () => {
  describe('root route', () => {
    it('always returns allow_all for "/"', () => {
      expect(classify('/')).toBe('allow_all');
    });

    it('always returns allow_all for ""', () => {
      expect(classify('')).toBe('allow_all');
    });
  });

  describe('public routes (publicRoutes segments)', () => {
    it('allows /login/sign-in', () => {
      expect(classify('/login/sign-in')).toBe('allow_all');
    });

    it('allows /login/sign-up', () => {
      expect(classify('/login/sign-up')).toBe('allow_all');
    });

    it('allows /web/download', () => {
      expect(classify('/web/download')).toBe('allow_all');
    });

    it('allows /web root', () => {
      expect(classify('/web')).toBe('allow_all');
    });

    // ── Substring-trap tests ──────────────────────────────────────────────
    // These routes contain public segment words but must NOT be treated as public.
    it('does NOT treat /mainland as public despite containing "main"', () => {
      expect(classify('/mainland')).not.toBe('allow_all');
    });

    it('does NOT treat /webinar as public despite containing "web"', () => {
      expect(classify('/webinar')).not.toBe('allow_all');
    });

    it('does NOT treat /login-history as public despite containing "login"', () => {
      // /login-history is a single segment, not starting with /login/
      expect(classify('/login-history')).not.toBe('allow_all');
    });

    it('does NOT treat /new-login as public (login is not the leading segment)', () => {
      expect(classify('/new-login')).not.toBe('allow_all');
    });
  });

  describe('protected /main/* routes — require_permission', () => {
    it('requires permission for /main/main-landing', () => {
      expect(classify('/main/main-landing')).toBe('require_permission');
    });

    it('requires permission for /main/world', () => {
      expect(classify('/main/world')).toBe('require_permission');
    });

    it('requires permission for /main/characters-npcs', () => {
      expect(classify('/main/characters-npcs')).toBe('require_permission');
    });

    it('requires permission for deep nested /main routes', () => {
      expect(classify('/main/characters-npcs/faction-tracker')).toBe('require_permission');
    });
  });

  describe('protected non-main routes — require_auth', () => {
    it('requires auth for /select/world-selection', () => {
      expect(classify('/select/world-selection')).toBe('require_auth');
    });

    it('requires auth for /settings/[username]', () => {
      expect(classify('/settings/johndoe')).toBe('require_auth');
    });

    it('requires auth for /settings', () => {
      expect(classify('/settings')).toBe('require_auth');
    });

    it('requires auth for unknown routes', () => {
      expect(classify('/unknown-feature')).toBe('require_auth');
    });
  });

  describe('override flags take precedence over mode', () => {
    it('forcePublic returns allow_all even for a main route', () => {
      expect(PolicyEngine.getPolicyForRoute('/main/world', 'protected_by_default', { forcePublic: true })).toBe('allow_all');
    });

    it('forceAuth returns require_auth even for a public route', () => {
      expect(PolicyEngine.getPolicyForRoute('/login/sign-in', 'protected_by_default', { forceAuth: true })).toBe('require_auth');
    });

    it('forcePermission returns require_permission', () => {
      expect(PolicyEngine.getPolicyForRoute('/select/world-selection', 'protected_by_default', { forcePermission: true })).toBe('require_permission');
    });

    it('forceAdmin returns require_admin', () => {
      expect(PolicyEngine.getPolicyForRoute('/select/world-selection', 'protected_by_default', { forceAdmin: true })).toBe('require_admin');
    });
  });
});

// ─── public_by_default mode ───────────────────────────────────────────────────

describe('PolicyEngine.getPolicyForRoute — public_by_default', () => {
  describe('unprotected routes are allowed', () => {
    it('allows /login/sign-in', () => {
      expect(classify('/login/sign-in', 'public_by_default')).toBe('allow_all');
    });

    it('allows /web/download', () => {
      expect(classify('/web/download', 'public_by_default')).toBe('allow_all');
    });

    it('allows unknown routes', () => {
      expect(classify('/unknown-feature', 'public_by_default')).toBe('allow_all');
    });
  });

  describe('explicitly protected routes', () => {
    it('requires permission for /main/main-landing', () => {
      expect(classify('/main/main-landing', 'public_by_default')).toBe('require_permission');
    });

    it('requires auth for /select/world-selection', () => {
      expect(classify('/select/world-selection', 'public_by_default')).toBe('require_auth');
    });

    it('requires auth for /settings/admin-panel', () => {
      expect(classify('/settings/admin-panel', 'public_by_default')).toBe('require_auth');
    });
  });

  describe('substring-trap protection in public_by_default', () => {
    it('does NOT require auth for /settlement (not a protected segment prefix)', () => {
      expect(classify('/settlement', 'public_by_default')).toBe('allow_all');
    });

    it('does NOT require auth for /maintain (not a /main prefix)', () => {
      expect(classify('/maintain', 'public_by_default')).toBe('allow_all');
    });
  });
});
