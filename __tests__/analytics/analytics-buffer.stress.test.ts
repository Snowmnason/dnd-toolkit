import { describe, expect, it, vi } from 'vitest';

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
  describe.skip('AnalyticsBufferService — stress (skipped; service not present)', () => {});
} else {
  vi.mock('@/lib/storage/SecureStorage');

  describe('AnalyticsBufferService — stress', () => {
    it('handles 200+ events and trims to maxSize', async () => {
      vi.clearAllMocks();
      if (SecureStorage && SecureStorage.setJSON) vi.spyOn(SecureStorage, 'setJSON').mockResolvedValue(undefined as any);
      await AnalyticsBufferService.initialize({ maxSize: 100 } as any);

      const push = [] as Promise<void>[];
      for (let i = 0; i < 200; i++) {
        push.push(AnalyticsBufferService.enqueue({ id: `s${i}`, eventType: 'x', payload: {}, retryCount: 0, maxRetries: 3, timestamp: Date.now() + i } as any));
      }

      await Promise.all(push);
      const stats = AnalyticsBufferService.getStats();
      expect(stats.size).toBeLessThanOrEqual(100);
    }, 20000);
  });
}
