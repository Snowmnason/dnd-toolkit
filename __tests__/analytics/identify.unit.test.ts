/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetUser = vi.fn();
const mockTracker = {
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: mockSetUser,
  isEnabled: vi.fn().mockReturnValue(true),
};

vi.mock('@/lib/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services')>();
  return { ...actual, getErrorTracker: () => mockTracker };
});

vi.mock('@/lib/config/loader', () => ({ getAppConfig: () => ({ features: { sentryEnabled: true } }), isDevelopment: () => false }));

import { Analytics } from '@/lib/analytics';
import { AnalyticsConsent } from '@/lib/analytics/consent';

beforeEach(async () => {
  // Reset consent to default (basic) before each test
  AnalyticsConsent.resetToDefault?.();
  // Clear mock
  mockSetUser.mockClear();
});

describe('Analytics.identify consent behavior', () => {
  it('clears user for none and basic, sets user only for full', async () => {
    const user = { id: 'u1', username: 'bob' };

    await AnalyticsConsent.setLevel('none');
    Analytics.identify(user);
    expect(mockSetUser).toHaveBeenCalledWith(null);

    mockSetUser.mockClear();
    await AnalyticsConsent.setLevel('basic');
    Analytics.identify(user);
    expect(mockSetUser).toHaveBeenCalledWith(null);

    mockSetUser.mockClear();
    await AnalyticsConsent.setLevel('full');
    Analytics.identify(user);
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u1', username: 'bob' });
  });
});
