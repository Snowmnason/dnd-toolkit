/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it } from 'vitest';

import { breadcrumbQueue } from '@/lib/analytics/breadcrumb-queue';

describe('BreadcrumbQueue - Integration', () => {
  beforeEach(async () => {
    try {
      await breadcrumbQueue.clear();
    } catch (e) {}
  });

  it('flush sends and removes successful breadcrumbs', async () => {
    let sawBatch: any[] | null = null;

    const provider = {
      name: 'integration-mock',
      sendBatch: async (batch: any) => {
        sawBatch = batch;
        return { sent: batch.map((b: any) => b.id), retry: [], discard: [] };
      },
    } as any;

    await breadcrumbQueue.initialize(provider);

    const now = Date.now();
    const queued = await breadcrumbQueue.enqueue({ timestamp: now, category: 'http', level: 'info', message: 'flush-test', data: {} } as any);
    expect(queued).toBeDefined();

    await breadcrumbQueue.flush();

    expect(sawBatch).not.toBeNull();
    const stats = breadcrumbQueue.getStats();
    expect(stats.queueSize).toBe(0);
  });

  it('flush with provider retry keeps item and increments retryCount', async () => {
    const provider = {
      name: 'integration-mock-retry',
      sendBatch: async (batch: any) => {
        // Tell the queue to retry the items
        return { sent: [], retry: batch.map((b: any) => b.id), discard: [] };
      },
    } as any;

    await breadcrumbQueue.initialize(provider);

    const now = Date.now();
    const q = await breadcrumbQueue.enqueue({ timestamp: now, category: 'http', level: 'warn', message: 'retry-test', data: {} } as any);
    expect(q).toBeDefined();

    await breadcrumbQueue.flush();

    // Item should remain in queue and have retryCount incremented
    const batch = breadcrumbQueue.peek(10);
    expect(batch.length).toBeGreaterThanOrEqual(1);
    expect(batch[0].retryCount).toBe(1);
  });
});
