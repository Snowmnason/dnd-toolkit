import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsConsent } from '@/lib/analytics/consent/consent';
import { Analytics } from '@/managers/analytics/analytics-manager';
import { STORAGE_KEYS } from '@/maps';
import { loadAnalyticsQueue, loadAnalyticsQueueJSON, persistAnalyticsQueue, persistAnalyticsQueueJSON } from '@/middleware/storage';
import { currentConsentLevel, setCurrentConsentLevel } from '@/type-definitions/analytics-types';

vi.mock('@/lib/utils', () => {
  const loggerMock = {
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      analytics: vi.fn(),
      perf: vi.fn(),
      batch: vi.fn(),
    })),
  };

  return {
    logger: loggerMock,
    default: loggerMock,
  };
});

vi.mock('@/middleware/storage', () => ({
  loadAnalyticsQueue: vi.fn(),
  loadAnalyticsQueueJSON: vi.fn(),
  persistAnalyticsQueue: vi.fn(),
  persistAnalyticsQueueJSON: vi.fn(),
  clearAnalyticsQueue: vi.fn(),
}));

vi.mock('@/lib/database', () => ({
  isDatabaseConfigured: vi.fn(() => false),
  userSettingsDB: {
    fetchCurrentUserSettings: vi.fn(),
  },
}));

vi.mock('@/lib/analytics/consent/consent-sync-queue', () => ({
  ConsentSyncQueue: {
    enqueue: vi.fn(async () => 'sync-id'),
  },
}));

vi.mock('@/lib/error', () => ({
  clearErrorUser: vi.fn(),
  isTrackingEnabled: vi.fn(() => true),
  setErrorUser: vi.fn(),
}));

vi.mock('@/lib/analytics/exporters/analytics-buffer', () => ({
  analyticsBufferService: {
    enqueue: vi.fn(),
  },
}));

vi.mock('@/lib/analytics/utils', () => ({
  getThreshold: vi.fn(() => 3000),
  sanitizeError: vi.fn(),
}));

describe('AnalyticsConsent (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AnalyticsConsent.resetToDefault();
    setCurrentConsentLevel('basic');
  });

  it('falls back to the default level when storage is empty', async () => {
    vi.mocked(loadAnalyticsQueue).mockResolvedValueOnce(null);
    vi.mocked(loadAnalyticsQueueJSON).mockResolvedValueOnce(null);

    const level = await AnalyticsConsent.initialize();

    expect(level).toBe('basic');
    expect(AnalyticsConsent.getLevel()).toBe('basic');
    expect(currentConsentLevel).toBe('basic');
  });

  it('persists consent through the manager and keeps the global level in sync', async () => {
    await Analytics.updateConsentLevel('full');

    expect(AnalyticsConsent.getLevel()).toBe('full');
    expect(currentConsentLevel).toBe('full');
    expect(persistAnalyticsQueue).toHaveBeenCalledWith(STORAGE_KEYS.ANALYTICS_CONSENT, 'full');
    expect(persistAnalyticsQueueJSON).toHaveBeenCalledWith(STORAGE_KEYS.ANALYTICS_CONSENT_META, {
      timestamp: expect.any(Number),
      source: 'user',
    });
  });

  it('falls back to the default level when storage raises an error', async () => {
    vi.mocked(loadAnalyticsQueue).mockRejectedValueOnce(new Error('storage fail'));

    const level = await AnalyticsConsent.initialize();

    expect(level).toBe('basic');
    expect(AnalyticsConsent.getLevel()).toBe('basic');
    expect(currentConsentLevel).toBe('basic');
  });
});
