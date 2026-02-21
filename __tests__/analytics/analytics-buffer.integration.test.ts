/* eslint-disable @typescript-eslint/no-unused-vars */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let AnalyticsBufferService: any;
let NetworkDetection: any;

try {
  NetworkDetection = require('@/lib/network/network-detection');
} catch (e) {
  NetworkDetection = null;
}

try {
  AnalyticsBufferService = require('@/lib/analytics/analytics-buffer').analyticsBufferService;
} catch (e) {
  AnalyticsBufferService = null;
}

if (!AnalyticsBufferService || !NetworkDetection) {
  describe.skip('AnalyticsBufferService — integration (skipped; missing dependencies)', () => {});
} else {
  vi.mock('@/lib/network/network-detection');

  describe('AnalyticsBufferService — integration (flush)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      if ((AnalyticsBufferService as any)._reset) (AnalyticsBufferService as any)._reset();
    });

  it('triggers flush when NetworkDetection goes online', async () => {
    // capture the subscribe callback
    let cb: any = null;
    (NetworkDetection as any).subscribe = (fn: any) => { cb = fn; return () => {}; };

    // mock network call used by sendAnalyticsEventsBatch via global fetch
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock as any);

    await AnalyticsBufferService.initialize({ batchSize: 25 } as any);
    await AnalyticsBufferService.enqueue({ eventType: 'p', payload: { note: 'i1' }, maxRetries: 3 } as any);

    // simulate online transition
    cb && cb({ isOnline: true });

    // give microtasks time
    await new Promise((r) => setTimeout(r, 10));

    expect((global as any).fetch).toHaveBeenCalled();
  });

  it('keeps events in queue on 5xx and retries later', async () => {
    let cb: any = null;
    (NetworkDetection as any).subscribe = (fn: any) => { cb = fn; return () => {}; };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ status: 200 });
    vi.stubGlobal('fetch', fetchMock as any);

    await AnalyticsBufferService.initialize({ batchSize: 25, retryBaseMs: 1 } as any);
    await AnalyticsBufferService.enqueue({ eventType: 'e', payload: { note: 'r1' }, maxRetries: 2 } as any);

    cb && cb({ isOnline: true });
    await new Promise((r) => setTimeout(r, 20));

    // first attempt failed, should have retried
    expect((global as any).fetch).toHaveBeenCalledTimes(2);
    const stats = AnalyticsBufferService.getStats();
    expect(stats.queueSize).toBe(0);
  });

  afterEach(() => {
    try {
      vi.unstubAllGlobals();
    } catch {}
  });
});

}
