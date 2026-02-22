import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAuthProvider } from '../test-helpers/mock-auth-provider';

describe('Auth Provider Registration', () => {
  beforeEach(() => {
    // Reset module registry so the auth provider registry is fresh per-test
    vi.resetModules();
  });

  it('getAuthProvider() rejects when not registered', async () => {
    const { getAuthProvider, ProviderInitializationError } = await import('@/lib/services');
    await expect(getAuthProvider()).rejects.toBeInstanceOf(ProviderInitializationError);
  });

  it('registerAuthProvider(instance) registers and getAuthProvider resolves', async () => {
    const { registerAuthProvider, getAuthProvider, getAuthProviderSync } = await import('@/lib/services');
    const mock = createMockAuthProvider();
    await registerAuthProvider(mock as any);
    const p = await getAuthProvider();
    expect(p).toBeDefined();
    const sync = getAuthProviderSync();
    expect(sync).not.toBeNull();
  });

  it('registerAuthProvider(factory) instantiates provider on first get', async () => {
    const { registerAuthProvider, getAuthProvider } = await import('@/lib/services');
    const factory = async () => createMockAuthProvider();
    await registerAuthProvider(factory as any);
    const p1 = await getAuthProvider();
    const p2 = await getAuthProvider();
    expect(p1).toBe(p2);
  });
});
