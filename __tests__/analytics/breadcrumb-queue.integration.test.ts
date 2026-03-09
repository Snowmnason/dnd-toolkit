/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { breadcrumbQueue } from '@/lib/analytics/exporters/breadcrumb-queue';

describe.skip('BreadcrumbQueue - Integration', () => {
  beforeEach(async () => {
    try {
      await breadcrumbQueue.clear();
    } catch (e) {}
  });

  it('flush sends and removes successful breadcrumbs', async () => {
    let sawBatch = null; // Define sawBatch to capture batch data

    const provider = {
      name: 'integration-mock',
      sendBatch: async (batch: any) => {
        sawBatch = batch; // Capture the batch data
        console.log('Saw batch:', batch); // Debugging output to verify batch content
        return { sent: batch.map((b: any) => b.id), retry: [], discard: [] };
      },
    } as any;

    const sendBatchSpy = vi.spyOn(provider, 'sendBatch'); // Spy on sendBatch
    console.log('sendBatch called:', sendBatchSpy.mock.calls.length); // Debugging output

    await breadcrumbQueue.initialize(provider);

    const now = Date.now();
    const queued = await breadcrumbQueue.enqueue({ timestamp: now, category: 'http', level: 'info', message: 'flush-test', data: {} } as any);
    expect(queued).toBeDefined();

    await breadcrumbQueue.flush();

    expect(sendBatchSpy.mock.calls.length).toBe(1); // Only one batch should be sent
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
