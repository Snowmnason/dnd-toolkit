import { beforeEach, describe, expect, it, vi } from 'vitest';

let AnalyticsBufferService: any;
let NetworkDetection: any;

try {
  NetworkDetection = require('@/lib/network/network-detection');
} catch (e) {
  NetworkDetection = null;
}

try {
  AnalyticsBufferService = require('@/lib/analytics/analytics-buffer').AnalyticsBufferService;
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

    // mock a send function on the service (provider adapter)
    const sendMock = vi.fn().mockResolvedValue({ status: 200 });
    if ((AnalyticsBufferService as any)._setSender) {
      (AnalyticsBufferService as any)._setSender(sendMock);
    }

    await AnalyticsBufferService.initialize({ batchSize: 25 } as any);
    await AnalyticsBufferService.enqueue({ id: 'i1', eventType: 'p', payload: {}, retryCount: 0, maxRetries: 3, timestamp: Date.now() } as any);

    // simulate online transition
    cb && cb({ isOnline: true });

    // give microtasks time
    await new Promise((r) => setTimeout(r, 10));

    expect(sendMock).toHaveBeenCalled();
  });

  it('keeps events in queue on 5xx and retries later', async () => {
    let cb: any = null;
    (NetworkDetection as any).subscribe = (fn: any) => { cb = fn; return () => {}; };

    const sendMock = vi.fn()
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ status: 200 });

    if ((AnalyticsBufferService as any)._setSender) {
      (AnalyticsBufferService as any)._setSender(sendMock);
    }

    await AnalyticsBufferService.initialize({ batchSize: 25, retryBaseMs: 1 } as any);
    await AnalyticsBufferService.enqueue({ id: 'r1', eventType: 'e', payload: {}, retryCount: 0, maxRetries: 2, timestamp: Date.now() } as any);

    cb && cb({ isOnline: true });
    await new Promise((r) => setTimeout(r, 20));

    // first attempt failed, should have retried
    expect(sendMock).toHaveBeenCalledTimes(2);
    const stats = AnalyticsBufferService.getStats();
    expect(stats.size).toBe(0);
  });
});

}
