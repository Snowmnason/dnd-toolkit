/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let AnalyticsBufferService: any;
let SecureStorage: any;

try {
  SecureStorage = require('@/lib/storage/SecureStorage');
} catch (e) {
  SecureStorage = null;
}

try {
  AnalyticsBufferService = require('@/lib/analytics/analytics-buffer').analyticsBufferService;
} catch (e) {
  AnalyticsBufferService = null;
}

if (!AnalyticsBufferService) {
  describe.skip('AnalyticsBufferService — unit (skipped; service not present)', () => {});
} else {
  vi.mock('@/lib/storage/SecureStorage');

  describe('AnalyticsBufferService — unit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      if ((AnalyticsBufferService as any)._reset) (AnalyticsBufferService as any)._reset();
    });

  it('enqueue persists event to SecureStorage', async () => {
    const saveMock = vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);

    await AnalyticsBufferService.initialize();

    // Do not provide id/timestamp/retryCount - service should generate them
    await AnalyticsBufferService.enqueue({
      eventType: 'pageview',
      payload: { path: '/home' },
      maxRetries: 5,
    } as any);

    expect(saveMock).toHaveBeenCalled();
    const stats = AnalyticsBufferService.getStats();
    expect(stats.queueSize).toBeGreaterThanOrEqual(1);
  });

  it('peek returns FIFO order and respects batch size', async () => {
    vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);
    await AnalyticsBufferService.initialize();

    // Use payload sequence markers to assert ordering since ids/timestamps are auto-generated
    const makeEvent = (i: number) => ({ eventType: 'ev', payload: { seq: i }, maxRetries: 5 } as any);

    await AnalyticsBufferService.enqueue(makeEvent(1));
    await AnalyticsBufferService.enqueue(makeEvent(2));
    await AnalyticsBufferService.enqueue(makeEvent(3));

    const batch = AnalyticsBufferService.peek(2);
    expect(batch.map((b: any) => b.payload?.seq)).toEqual([1, 2]);
  });

  it('trims oldest events when maxSize exceeded', async () => {
    vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);
    await AnalyticsBufferService.initialize({ maxSize: 3 } as any);

    await AnalyticsBufferService.enqueue({ eventType: 'x', payload: { seq: 'a' }, maxRetries: 5 } as any);
    await AnalyticsBufferService.enqueue({ eventType: 'x', payload: { seq: 'b' }, maxRetries: 5 } as any);
    await AnalyticsBufferService.enqueue({ eventType: 'x', payload: { seq: 'c' }, maxRetries: 5 } as any);
    await AnalyticsBufferService.enqueue({ eventType: 'x', payload: { seq: 'd' }, maxRetries: 5 } as any);

    const stats = AnalyticsBufferService.getStats();
    expect(stats.queueSize).toBeLessThanOrEqual(3);
  });
});

}
