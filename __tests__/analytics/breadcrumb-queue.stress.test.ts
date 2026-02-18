import { beforeEach, describe, expect, it } from 'vitest';

import { breadcrumbQueue } from '@/lib/analytics/breadcrumb-queue';

const provider = {
  name: 'stress-mock',
  sendBatch: async (batch: any) => ({ sent: batch.map((b: any) => b.id), retry: [], discard: [] }),
} as any;

describe('BreadcrumbQueue - Stress', () => {
  beforeEach(async () => {
    try {
      await breadcrumbQueue.clear();
    } catch (e) {}
    try {
      await breadcrumbQueue.initialize(provider);
    } catch (e) {}
  });

  it('handles overflow by dropping oldest breadcrumbs', async () => {
    const total = 600;
    for (let i = 0; i < total; i++) {
      // sequential enqueue to ensure persistence logic exercised
      // Use increasing timestamps so oldest are obvious
      // eslint-disable-next-line no-await-in-loop
      await breadcrumbQueue.enqueue({ timestamp: Date.now() + i, category: 'stress', level: 'info', message: `msg-${i}`, data: { i } } as any);
    }

    const stats = breadcrumbQueue.getStats();
    // Default maxBreadcrumbs is 500 in implementation
    expect(stats.queueSize).toBeLessThanOrEqual(500);
    const overflow = breadcrumbQueue.getAndResetOverflowCount();
    expect(overflow).toBeGreaterThanOrEqual(100);
  }, 120_000);
});
