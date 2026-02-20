import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ensure feature-flag for persistence is enabled in tests
vi.mock('@/lib/config/loader', () => ({
  getAppConfig: () => ({ featureFlags: { 'persist-analytics-consent': { enabled: true } } }),
}));

import { AnalyticsConsent, ConsentLevel } from '@/lib/analytics/consent';
import { SecureStorage } from '@/lib/storage';

describe('AnalyticsConsent (unit)', () => {
  beforeEach(() => {
    // Reset mocks and in-memory state
    vi.resetAllMocks();
    AnalyticsConsent.resetToDefault();
  });

  it('initializes from SecureStorage when cache is fresh', async () => {
    const mockLevel: ConsentLevel = 'full';
    (SecureStorage.getItem as jest.Mock ?? SecureStorage.getItem as any).mockResolvedValueOnce(mockLevel);
    (SecureStorage.getJSON as jest.Mock ?? SecureStorage.getJSON as any).mockResolvedValueOnce({ timestamp: Date.now() });

    const level = await AnalyticsConsent.initialize();
    expect(level).toBe(mockLevel);
    expect(AnalyticsConsent.getLevel()).toBe(mockLevel);
  });

  it('falls back to default when storage missing or invalid', async () => {
    (SecureStorage.getItem as any).mockResolvedValueOnce(undefined);
    (SecureStorage.getJSON as any).mockResolvedValueOnce(undefined);

    const level = await AnalyticsConsent.initialize();
    expect(level).toBe('basic');
    expect(AnalyticsConsent.getLevel()).toBe('basic');
  });

  it('setLevel persists to SecureStorage and updates in-memory', async () => {
    (SecureStorage.setItem as any).mockResolvedValueOnce(undefined);

    await AnalyticsConsent.setLevel('full');
    expect(AnalyticsConsent.getLevel()).toBe('full');
    expect((SecureStorage.setItem as any).mock.calls.length).toBeGreaterThan(0);
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
