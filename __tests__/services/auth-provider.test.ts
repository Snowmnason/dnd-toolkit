import { getAuthProvider, getAuthProviderSync, ProviderInitializationError, registerAuthProvider } from '@/lib/services';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockAuthProvider } from '../test-helpers/mock-auth-provider';

describe('Auth Provider Registration', () => {
  beforeEach(() => {
    // Clear any registered provider by re-registering a no-op factory
    // There's no explicit unregister; tests will register fresh providers.
  });

  it('getAuthProvider() rejects when not registered', async () => {
    await expect(getAuthProvider()).rejects.toBeInstanceOf(ProviderInitializationError);
  });

  it('registerAuthProvider(instance) registers and getAuthProvider resolves', async () => {
    const mock = createMockAuthProvider();
    await registerAuthProvider(mock as any);
    const p = await getAuthProvider();
    expect(p).toBeDefined();
    // getAuthProviderSync should return the instance when instantiated
    const sync = getAuthProviderSync();
    expect(sync).not.toBeNull();
  });

  it('registerAuthProvider(factory) instantiates provider on first get', async () => {
    const factory = async () => createMockAuthProvider();
    await registerAuthProvider(factory as any);
    const p1 = await getAuthProvider();
    const p2 = await getAuthProvider();
    expect(p1).toBe(p2);
  });
});
