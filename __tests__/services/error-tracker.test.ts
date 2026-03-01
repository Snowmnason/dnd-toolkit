import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ErrorCaptureOptions,
  getErrorTracker,
  NoOpErrorTracker,
  registerErrorTracker,
  resetErrorTracker,
} from '@/system/Services/error-adapter';

// Top-level mocks to avoid pulling in react-native/expo during module imports
const captureException = vi.fn();
const captureMessage = vi.fn();
const addBreadcrumb = vi.fn();
const setUser = vi.fn();

vi.mock('@sentry/react-native', () => ({
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
}));

vi.mock('expo-constants', () => ({
  expoConfig: { extra: { sentryDsn: 'test-dsn' } },
}));

vi.mock('@/lib/config', () => ({
  getAppConfig: () => ({ services: { errorProvider: { enabled: true } } }),
  isDevelopment: () => false,
}));

describe('ErrorTrackerProvider', () => {
  beforeEach(() => {
    // Ensure clean singleton state between tests
    resetErrorTracker();
    // Ensure DSN present for Sentry enablement checks
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'test-dsn';
    vi.resetAllMocks();
  });

  afterEach(() => {
    resetErrorTracker();
  });

  it('returns NoOpErrorTracker by default and methods no-op', () => {
    const tracker = getErrorTracker();
    expect(tracker).toBeInstanceOf(NoOpErrorTracker);
    expect(tracker.isEnabled()).toBe(false);

    // Should not throw
    expect(() => tracker.captureException(new Error('boom'))).not.toThrow();
    expect(() => tracker.captureMessage('msg', 'error')).not.toThrow();
    expect(() => tracker.addBreadcrumb({ category: 'test', message: 'm' })).not.toThrow();
    expect(() => tracker.setUser({ id: 'u1' })).not.toThrow();
  });

  it('registerErrorTracker replaces default and calls delegate methods', () => {
    const calls: string[] = [];
    const mockProvider = {
      captureException: (err: Error) => calls.push(`exc:${err.message}`),
      captureMessage: (msg: string) => calls.push(`msg:${msg}`),
      addBreadcrumb: (b: any) => calls.push(`bc:${b.category}:${b.message}`),
      setUser: (u: any) => calls.push(`user:${u ? u.id : 'null'}`),
      isEnabled: () => true,
    } as any;

    registerErrorTracker(mockProvider);
    const t = getErrorTracker();
    t.captureException(new Error('boom'));
    t.captureMessage('hello');
    t.addBreadcrumb({ category: 'auth', message: 'signed-in' });
    t.setUser({ id: 'user:1' });

    expect(calls).toContain('exc:boom');
    expect(calls).toContain('msg:hello');
    expect(calls).toContain('bc:auth:signed-in');
    expect(calls).toContain('user:user:1');
  });

  it('SentryErrorTracker calls Sentry SDK with mapped options', async () => {
    // Import SentryErrorTracker after top-level mocks
    const { SentryErrorTracker: Tracker } = await import('@/system/Services/sentry/sentry-error-tracker');
    const tracker = new Tracker();

    // captureException mapping
    const opts: ErrorCaptureOptions = {
      tags: { t: '1' },
      extra: { k: 'v' },
      level: 'error',
      fingerprint: ['f1'],
      contexts: { os: { name: 'test' } },
    };

    tracker.captureException(new Error('fail'), opts);
    expect(captureException).toHaveBeenCalledTimes(1);
    const callArgs = captureException.mock.calls[0];
    expect(callArgs[0].message).toBe('fail');
    expect(callArgs[1].tags).toEqual(opts.tags);
    expect(callArgs[1].extra).toEqual(opts.extra);
    expect(callArgs[1].level).toBe(opts.level);
    expect(callArgs[1].fingerprint).toEqual(opts.fingerprint);

    // captureMessage mapping
    tracker.captureMessage('mymessage', 'warning');
    expect(captureMessage).toHaveBeenCalledWith('mymessage', 'warning');

    // addBreadcrumb mapping (timestamp conversion)
    const now = Date.now();
    tracker.addBreadcrumb({ category: 'api', message: 'called', timestamp: now, level: 'info' });
    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
    const bcArg = addBreadcrumb.mock.calls[0][0];
    expect(bcArg.category).toBe('api');
    expect(bcArg.message).toBe('called');
    expect(bcArg.level).toBe('info');
    // timestamp converted to seconds
    expect(bcArg.timestamp).toBeCloseTo(now / 1000, 0);

    // setUser mapping
    tracker.setUser({ id: 'u1', email: 'e@d' });
    expect(setUser).toHaveBeenCalledWith({ id: 'u1', email: 'e@d' });
  });
});
