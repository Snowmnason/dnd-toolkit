/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsConsent } from '@/lib/analytics/consent/consent';
import { breadcrumbQueue } from '@/lib/analytics/exporters/breadcrumb-queue';

const mockProvider = {
  name: 'mock-provider',
  sendBatch: async (batch: any) => ({ sent: batch.map((b: any) => b.id), retry: [], discard: [] }),
};

describe('BreadcrumbQueue - Unit', () => {
  beforeEach(async () => {
    // Ensure clean state between tests
    try {
      await breadcrumbQueue.clear();
    } catch (e) {
      // ignore
    }
    // Ensure consent allows usage-level breadcrumbs in tests
    try {
      await AnalyticsConsent.setLevel('full');
    } catch (e) {
      // ignore in constrained test env
    }

    // Initialize with a simple provider if not initialized
    try {
      await breadcrumbQueue.initialize(mockProvider as any);
    } catch (e) {
      // ignore initialization errors in environments where provider wiring differs
    }
  });

  it('enqueue persists and increases queue size', async () => {
    const now = Date.now();
    const queued = await breadcrumbQueue.enqueue({ timestamp: now, category: 'ui', level: 'info', message: 'unit-enqueue', data: { seq: 1 } } as any);
    expect(queued).toBeDefined();
    const stats = breadcrumbQueue.getStats();
    expect(stats.queueSize).toBeGreaterThanOrEqual(1);
  });

  it('peek returns FIFO order', async () => {
    const now = Date.now();
    await breadcrumbQueue.enqueue({ timestamp: now + 1, category: 'ui', level: 'info', message: 'first', data: { seq: 1 } } as any);
    await breadcrumbQueue.enqueue({ timestamp: now + 2, category: 'ui', level: 'info', message: 'second', data: { seq: 2 } } as any);

    const batch = breadcrumbQueue.peek(10);
    expect(batch.length).toBeGreaterThanOrEqual(2);
    expect(batch[0].message).toBe('first');
    expect(batch[1].message).toBe('second');
  });

  it('remove deletes breadcrumbs by id', async () => {
    const now = Date.now();
    const q = await breadcrumbQueue.enqueue({ timestamp: now, category: 'ui', level: 'info', message: 'to-remove', data: {} } as any);
    expect(q).toBeDefined();
    const id = q!.id;
    await breadcrumbQueue.remove([id]);
    const stats = breadcrumbQueue.getStats();
    expect(stats.queueSize).toBe(0);
  });

  it('dedup prevents duplicate breadcrumbs within TTL', async () => {
    const now = Date.now();
    const first = await breadcrumbQueue.enqueue({ timestamp: now, category: 'ui', level: 'info', message: 'dedup', data: {} } as any);
    expect(first).toBeDefined();
    // Simulate successful send so fingerprint is recorded in dedup cache
    await breadcrumbQueue.flush();
    const second = await breadcrumbQueue.enqueue({ timestamp: now + 1, category: 'ui', level: 'info', message: 'dedup', data: {} } as any);
    // Now should be deduped (null) because same fingerprint within TTL
    expect(second).toBeNull();
  });
});
