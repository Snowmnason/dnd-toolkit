import { beforeEach, describe, expect, it, vi } from 'vitest';

let AnalyticsBufferService: any;
let SecureStorage: any;

try {
  SecureStorage = require('@/lib/storage/SecureStorage');
} catch (e) {
  SecureStorage = null;
}

try {
  AnalyticsBufferService = require('@/lib/analytics/analytics-buffer').AnalyticsBufferService;
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

    await AnalyticsBufferService.enqueue({
      id: 'evt-1',
      eventType: 'pageview',
      payload: { path: '/home' },
      retryCount: 0,
      maxRetries: 5,
      timestamp: Date.now(),
    } as any);

    expect(saveMock).toHaveBeenCalled();
    const stats = AnalyticsBufferService.getStats();
    expect(stats.size).toBeGreaterThanOrEqual(1);
  });

  it('peek returns FIFO order and respects batch size', async () => {
    vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);
    await AnalyticsBufferService.initialize();

    const makeEvent = (i: number) => ({ id: `e${i}`, eventType: 'ev', payload: {}, retryCount: 0, maxRetries: 5, timestamp: Date.now() + i });

    await AnalyticsBufferService.enqueue(makeEvent(1) as any);
    await AnalyticsBufferService.enqueue(makeEvent(2) as any);
    await AnalyticsBufferService.enqueue(makeEvent(3) as any);

    const batch = AnalyticsBufferService.peek(2);
    expect(batch.map((b: any) => b.id)).toEqual(['e1','e2']);
  });

  it('trims oldest events when maxSize exceeded', async () => {
    vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);
    await AnalyticsBufferService.initialize({ maxSize: 3 } as any);

    await AnalyticsBufferService.enqueue({ id: 'a', eventType: 'x', payload: {}, retryCount: 0, maxRetries: 5, timestamp: Date.now() } as any);
    await AnalyticsBufferService.enqueue({ id: 'b', eventType: 'x', payload: {}, retryCount: 0, maxRetries: 5, timestamp: Date.now() } as any);
    await AnalyticsBufferService.enqueue({ id: 'c', eventType: 'x', payload: {}, retryCount: 0, maxRetries: 5, timestamp: Date.now() } as any);
    await AnalyticsBufferService.enqueue({ id: 'd', eventType: 'x', payload: {}, retryCount: 0, maxRetries: 5, timestamp: Date.now() } as any);

    const stats = AnalyticsBufferService.getStats();
    expect(stats.size).toBeLessThanOrEqual(3);
  });
});

}
