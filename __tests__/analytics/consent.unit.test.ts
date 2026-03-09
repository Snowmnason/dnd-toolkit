import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsConsent, ConsentLevel } from '@/lib/analytics/consent/consent';
import { SecureStorage } from '@/system/Storage';

// Mock SecureStorage from @/system/Storage
vi.mock('@/system/Storage', () => {
  return {
    SecureStorage: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      getJSON: vi.fn(),
      setJSON: vi.fn(),
      removeItem: vi.fn(),
    },
    STORAGE_KEYS: { ANALYTICS_CONSENT: 'dnd:analytics:consent', ANALYTICS_CONSENT_META: 'dnd:analytics:consent_meta' },
  };
});

describe('AnalyticsConsent (unit)', () => {
  beforeEach(() => {
    // Reset mocks and in-memory state
    vi.resetAllMocks();
    AnalyticsConsent.resetToDefault();
  });

  it('reads stored consent via getStoredConsent', async () => {
    const mockLevel: ConsentLevel = 'full';
    const spyGet = vi.spyOn(SecureStorage, 'getItem' as any).mockResolvedValueOnce(mockLevel as any);

    const stored = await AnalyticsConsent.getStoredConsent();
    expect(spyGet).toHaveBeenCalled();
    expect(stored).toBe(mockLevel);
  });

  it('falls back to default when storage missing or invalid', async () => {
    (SecureStorage.getItem as any).mockResolvedValueOnce(undefined);
    (SecureStorage.getJSON as any).mockResolvedValueOnce(undefined);

    const level = await AnalyticsConsent.initialize();
    expect(level).toBe('basic');
    expect(AnalyticsConsent.getLevel()).toBe('basic');
  });

  it('setLevel persists to SecureStorage and updates in-memory', async () => {
    // implement a small in-memory fake storage so set/get interplay can be verified
    const store: Record<string, any> = {};
    vi.spyOn(SecureStorage, 'setItem' as any).mockImplementation((...args: any[]) => {
      const key = args[0] as string;
      const value = args[1];
      // eslint-disable-next-line security/detect-object-injection
      store[key] = value;
      return Promise.resolve();
    });
    vi.spyOn(SecureStorage, 'getItem' as any).mockImplementation((...args: any[]) => {
      const key = args[0] as string;
      // eslint-disable-next-line security/detect-object-injection
      return Promise.resolve(store[key]);
    });

    await AnalyticsConsent.setLevel('full');
    expect(AnalyticsConsent.getLevel()).toBe('full');

    const persisted = await AnalyticsConsent.getStoredConsent();
    expect(persisted).toBe('full');
  });

  it('isAllowed respects consent levels', async () => {
    AnalyticsConsent.resetToDefault();
    expect(AnalyticsConsent.getLevel()).toBe('basic');
    expect(AnalyticsConsent.isAllowed('essential')).toBe(true);
    expect(AnalyticsConsent.isAllowed('usage')).toBe(false);

    await AnalyticsConsent.setLevel('full');
    expect(AnalyticsConsent.isAllowed('usage')).toBe(true);
  });

  it('storage errors during initialize do not throw and default is used', async () => {
    (SecureStorage.getItem as any).mockRejectedValueOnce(new Error('storage fail'));
    const level = await AnalyticsConsent.initialize();
    expect(level).toBe('basic');
  });
});
