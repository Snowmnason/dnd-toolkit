/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react-native', () => ({ setUser: vi.fn() }));

// Ensure getAppConfig reports Sentry enabled for the test environment
vi.mock('@/lib/config/loader', () => ({ getAppConfig: () => ({ features: { sentryEnabled: true } }) }));

// Ensure isSentryEnabled() sees a DSN during tests so Sentry calls run
process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

import { Analytics } from '@/lib/analytics';
import { AnalyticsConsent } from '@/lib/analytics/consent';
import * as Sentry from '@sentry/react-native';

beforeEach(async () => {
  // Reset consent to default (basic) before each test
  AnalyticsConsent.resetToDefault?.();
  // Clear mock
  (Sentry.setUser as any).mockClear();
});

describe('Analytics.identify consent behavior', () => {
  it('clears user for none and basic, sets user only for full', async () => {
    const user = { id: 'u1', username: 'bob' };

    await AnalyticsConsent.setLevel('none');
    Analytics.identify(user);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);

    (Sentry.setUser as any).mockClear();
    await AnalyticsConsent.setLevel('basic');
    Analytics.identify(user);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);

    (Sentry.setUser as any).mockClear();
    await AnalyticsConsent.setLevel('full');
    Analytics.identify(user);
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u1', username: 'bob' });
  });
});
